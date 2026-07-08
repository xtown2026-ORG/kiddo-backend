import TeacherClassSession from "./teacher-class-session.model.js";
import TeacherAssignment from "../teacher-assignments/teacher-assignment.model.js";
import Timetable from "../timetables/timetable.model.js";
import Subject from "../subjects/subject.model.js";
import Class from "../classes/classes.model.js";
import Section from "../sections/section.model.js";
import Student from "../students/student.model.js";
import Attendance from "../attendance/attendance.model.js";
import AppError from "../../shared/appError.js";
import { Op } from "sequelize";

const MAX_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours fallback

async function closeStaleSessions({ teacher_id, school_id }) {
  const now = new Date();
  
  // Format current time in Asia/Kolkata
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const currentTimeStr = timeFormatter.format(now);

  const stale = await TeacherClassSession.findAll({
    where: {
      teacher_id,
      school_id,
      ended_at: null,
    },
  });

  for (const s of stale) {
    let shouldClose = false;
    
    // Fallback: If session is older than 12 hours, always close it
    if ((now - s.started_at) > MAX_SESSION_MS) {
      shouldClose = true;
    } else {
      // Check timetable to determine closing time
      let closingTime = "16:30:00";
      if (s.timetable_id) {
        const timetable = await Timetable.findByPk(s.timetable_id);
        if (timetable && timetable.end_time > "16:30:00") {
          closingTime = timetable.end_time;
        }
      }
      
      // Auto-close if we've passed the closing time
      if (currentTimeStr >= closingTime) {
        shouldClose = true;
      }
    }

    if (shouldClose) {
      s.ended_at = now;
      await s.save();
    }
  }
}

export async function startSession({
  user,
  school_id,
  teacher_assignment_id,
  timetable_id,
  subject_id, // ignored; backward compatibility
}) {
  let assignment = null;
  let timetable = null;

  // 1) Resolve assignment (direct or via timetable)
  if (teacher_assignment_id) {
    assignment = await TeacherAssignment.findOne({
      where: {
        id: teacher_assignment_id,
        school_id,
        is_active: true,
      },
    });
  } else if (timetable_id) {
    timetable = await Timetable.findOne({
      where: { id: timetable_id, school_id },
    });

    if (timetable?.teacher_assignment_id) {
      assignment = await TeacherAssignment.findOne({
        where: {
          id: timetable.teacher_assignment_id,
          school_id,
          is_active: true,
        },
      });
    }
  }

  if (!assignment) {
    throw new AppError("INVALID_ASSIGNMENT", 400);
  }

  // 2) Permission check
  if (user.role === "teacher" && assignment.teacher_id !== user.teacher_id) {
    throw new AppError("FORBIDDEN", 403);
  }

  // Auto-close stale sessions (older than 5 hours) so they don't block new starts
  await closeStaleSessions({
    teacher_id: assignment.teacher_id,
    school_id,
  });

  // 3) Prevent restarting a completed slot (same timetable/day)
  if (timetable_id) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const completedToday = await TeacherClassSession.findOne({
      where: {
        teacher_id: assignment.teacher_id,
        school_id,
        timetable_id,
        started_at: { [Op.gte]: startOfDay, [Op.lt]: endOfDay },
        ended_at: { [Op.ne]: null },
      },
    });

    if (completedToday) {
      throw new AppError("SESSION_ALREADY_COMPLETED_TODAY", 409);
    }
  }

  // 3) Validate timetable slot if provided
  if (timetable_id) {
    if (!timetable) {
      timetable = await Timetable.findOne({
        where: {
          id: timetable_id,
          teacher_assignment_id: assignment.id,
          school_id,
        },
      });
    }

    if (!timetable) {
      throw new AppError("INVALID_TIMETABLE_SLOT", 400);
    }
  }

  // 4) Create session
  return TeacherClassSession.create({
    school_id,
    teacher_assignment_id: assignment.id,
    teacher_id: assignment.teacher_id,
    class_id: assignment.class_id,
    section_id: assignment.section_id,
    timetable_id: timetable ? timetable.id : null,
    started_at: new Date(),
  });
}

export async function endSession({ session_id, user }) {
  const session = await TeacherClassSession.findByPk(session_id);

  if (!session || String(session.school_id) !== String(user.school_id)) {
    throw new AppError("SESSION_NOT_FOUND", 404);
  }

  if (session.ended_at) {
    throw new AppError("SESSION_ALREADY_ENDED", 409);
  }

  // optional: permission check
  if (user.role === "teacher" && session.teacher_id !== user.teacher_id) {
    throw new AppError("FORBIDDEN", 403);
  }

  session.ended_at = new Date();
  await session.save();

  return session;
}

export async function listSessions({ user, date }) {
  const teacherId = user.teacher_id;
  const where = {
    teacher_id: teacherId,
    school_id: user.school_id,
  };

  if (date) {
    const start = new Date(date);
    if (Number.isNaN(start.getTime())) {
      throw new AppError("INVALID_DATE", 400);
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.started_at = { [Op.gte]: start, [Op.lt]: end };
  }

  // Auto-close stale sessions before listing
  await closeStaleSessions({
    teacher_id: teacherId,
    school_id: user.school_id,
  });

  const rows = await TeacherClassSession.findAll({
    where,
    include: [
      {
        model: TeacherAssignment,
        attributes: ["id", "subject_id"],
        include: [
          {
            model: Subject,
            attributes: ["id", "name"],
          },
        ],
      },
      { model: Class, attributes: ["id", "class_name"] },
      { model: Section, attributes: ["id", "name"] },
      { model: Timetable, attributes: ["start_time", "end_time", "day_of_week"] },
    ],
    order: [["started_at", "DESC"]],
  });

  // Pre-fetch attendance counts per session
  const sessionIds = rows.map((r) => r.id);
  const attendanceCounts = await Attendance.findAll({
    attributes: [
      "teacher_class_session_id",
      [Attendance.sequelize.fn("COUNT", "*"), "count"],
    ],
    where: { teacher_class_session_id: sessionIds },
    group: ["teacher_class_session_id"],
    raw: true,
  });
  const attendanceMap = new Map(attendanceCounts.map((c) => [String(c.teacher_class_session_id), Number(c.count)]));

  const results = await Promise.all(
    rows.map(async (r) => {
      const expected = r.section_id
        ? await attendanceExpectedCache(r.section_id, r.class_id, r.school_id)
        : 0;
      const marked = attendanceMap.get(String(r.id)) || 0;

      return {
        id: r.id,
        started_at: r.started_at,
        ended_at: r.ended_at,
        class: r.class ? { id: r.class.id, name: r.class.class_name } : null,
        section: r.section ? { id: r.section.id, name: r.section.name } : null,
        subject: r.teacher_assignment?.subject || null,
        class_id: r.class_id,
        section_id: r.section_id,
        subject_id: r.teacher_assignment?.subject_id || null,
        timetable_id: r.timetable_id,
        attendance_expected: expected,
        attendance_marked: marked,
        attendance_complete: expected > 0 ? marked >= expected : false,
        timetable: r.timetable
          ? {
              start_time: r.timetable.start_time,
              end_time: r.timetable.end_time,
              day_of_week: r.timetable.day_of_week,
            }
          : null,
      };
    })
  );

  return results;
}

// simple cache for expected student count per section
const expectedCache = new Map();

async function attendanceExpectedCache(section_id, class_id, school_id) {
  const key = `${school_id}-${class_id}-${section_id}`;
  if (expectedCache.has(key)) return expectedCache.get(key);
  const count = await Student.count({
    where: {
      school_id,
      class_id,
      section_id,
      is_active: true,
    },
  });
  expectedCache.set(key, count);
  return count;
}
