import db from "../../config/db.js";
import { Op } from "sequelize";

import Timetable from "./timetable.model.js";
import Section from "../sections/section.model.js";
import Class from "../classes/classes.model.js";
import TeacherAssignment from "../teacher-assignments/teacher-assignment.model.js";
import Subject from "../subjects/subject.model.js";
import User from "../users/user.model.js";
import Teacher from "../teachers/teacher.model.js";
import AppError from "../../shared/appError.js";

/* =====================================================
   CREATE / UPDATE SECTION TIMETABLE
   (School Admin or Class Teacher)
===================================================== */
export const saveTimetableService = async ({
  user,
  school_id,
  class_id,
  section_id,
  day_of_week,
  entries,
}) => {
  return db.transaction(async (t) => {
    /**
     * 1️⃣ Validate section
     */
    const section = await Section.findOne({
      where: { id: section_id, class_id, school_id, is_active: true },
      transaction: t,
    });

    if (!section) {
      throw new AppError("SECTION_NOT_FOUND", 404);
    }

    /**
     * 2️⃣ Permission check
     * - School admin: always allowed
     * - Teacher: must be class teacher of this section
     */
    if (user.role === "teacher") {
      const isClassTeacher = await TeacherAssignment.findOne({
        where: {
          section_id,
          school_id,
          teacher_id: user.teacher_id,
          is_class_teacher: true,
          is_active: true,
        },
        transaction: t,
      });

      if (!isClassTeacher) {
        throw new AppError("FORBIDDEN", 403);
      }
    }

    /**
     * 3️⃣ Remove existing timetable for that day
     */
    await Timetable.destroy({
      where: { school_id, class_id, section_id, day_of_week },
      transaction: t,
    });

    /**
     * 4️⃣ Insert new timetable entries
     */
    for (const e of entries) {
      if (!e.is_break && !e.teacher_assignment_id) {
        throw new AppError("ASSIGNMENT_REQUIRED", 400);
      }

      let assignment = null;

      if (!e.is_break) {
        assignment = await TeacherAssignment.findOne({
          where: {
            id: e.teacher_assignment_id,
            school_id,
            class_id,
            section_id,
            is_active: true,
          },
          transaction: t,
        });

        if (!assignment) {
          throw new AppError("INVALID_TEACHER_ASSIGNMENT", 400);
        }
      }

      await Timetable.create(
        {
          school_id,
          class_id,
          section_id,
          day_of_week,
          start_time: e.start_time,
          end_time: e.end_time,
          teacher_assignment_id: e.is_break ? null : assignment.id,
          is_break: e.is_break,
          title: e.is_break ? e.title : null,
        },
        { transaction: t }
      );
    }

    return { success: true };
  });
};

/* =====================================================
   STUDENT VIEW: SECTION TIMETABLE
   (Mon–Sat, periods with subject & time)
===================================================== */
export const getSectionTimetableService = async ({
  school_id,
  class_id,
  section_id,
}) => {
  const rows = await Timetable.findAll({
    where: { school_id, class_id, section_id },
    include: [
      {
        model: TeacherAssignment,
        required: false,
        include: [
          {
            model: Subject,
            attributes: ["id", "name"],
          },
          {
            model: Teacher,
            attributes: ["id"],
            include: [{ model: User, attributes: ["name"] }],
          },
        ],
        attributes: ["id", "teacher_id", "subject_id"],
      },
    ],
    order: [
      ["day_of_week", "ASC"],
      ["start_time", "ASC"],
    ],
  });

  /**
   * Group by day_of_week (Monday → Saturday)
   */
  const grouped = {};

  for (const row of rows) {
    const day = row.day_of_week;
    if (!grouped[day]) grouped[day] = [];

    grouped[day].push({
      id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      is_break: row.is_break,
      title: row.is_break ? row.title : null,
      teacher_assignment_id: row.teacher_assignment?.id ?? null,
      teacher_id: row.teacher_assignment?.teacher_id ?? null,
      subject_id: row.teacher_assignment?.subject_id ?? null,
      subject: row.is_break ? null : row.teacher_assignment?.subject,
      teacher: row.teacher_assignment?.teacher?.user
        ? { id: row.teacher_assignment.teacher.id, name: row.teacher_assignment.teacher.user.name }
        : null,
    });
  }

  return grouped;
};

/* =====================================================
   TEACHER VIEW: OWN TIMETABLE
   (Which class, section, subject, time)
===================================================== */
export const getTeacherTimetableService = async ({
  school_id,
  teacher_id,
}) => {
  const teacherIds = Array.isArray(teacher_id) ? teacher_id : [teacher_id];

  // 1. Get classes and sections where this teacher has active assignments
  const assignments = await TeacherAssignment.findAll({
    where: {
      school_id,
      teacher_id: { [Op.in]: teacherIds.filter(Boolean) },
      is_active: true,
    },
    attributes: ["class_id", "section_id"],
  });

  const classIds = [...new Set(assignments.map((a) => a.class_id))];
  const sectionIds = [...new Set(assignments.map((a) => a.section_id))];

  if (!classIds.length || !sectionIds.length) {
    return {};
  }

  // 2. Fetch all timetable entries for these classes/sections
  const rows = await Timetable.findAll({
    where: {
      school_id,
      class_id: { [Op.in]: classIds },
      section_id: { [Op.in]: sectionIds },
    },
    include: [
      {
        model: TeacherAssignment,
        required: false,
        include: [
          {
            model: Subject,
            attributes: ["id", "name"],
          },
          {
            model: Teacher,
            attributes: ["id"],
            include: [{ model: User, attributes: ["name"] }],
          },
        ],
        attributes: ["id", "teacher_id", "subject_id"],
      },
      {
        model: Class,
        attributes: ["id", "class_name"],
      },
      {
        model: Section,
        attributes: ["id", "name"],
      },
    ],
    order: [
      ["day_of_week", "ASC"],
      ["start_time", "ASC"],
    ],
  });

  // Get current local time in Asia/Kolkata for status calculation
  const timezone = "Asia/Kolkata";
  const d = new Date();
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const currentTimeStr = timeFormatter.format(d);

  // Group by day_of_week AND class_id AND section_id to assign sequential period numbers
  const sectionDayGroups = {};
  for (const row of rows) {
    const key = `${row.day_of_week}-${row.class_id}-${row.section_id}`;
    if (!sectionDayGroups[key]) {
      sectionDayGroups[key] = [];
    }
    sectionDayGroups[key].push(row);
  }

  // Assign period number sequentially
  const periodNumberMap = new Map(); // maps row.id to "P1", "P2", etc.
  for (const key in sectionDayGroups) {
    // Sort by start_time (already sorted by query, but let's be safe)
    sectionDayGroups[key].sort((a, b) => a.start_time.localeCompare(b.start_time));
    sectionDayGroups[key].forEach((row, index) => {
      periodNumberMap.set(row.id, `P${index + 1}`);
    });
  }

  // Filter to keep only this teacher's periods and breaks/lunches
  const filteredRows = rows.filter((row) => {
    if (row.is_break || !row.teacher_assignment_id) {
      return true;
    }
    const teacherIdInAssignment = row.teacher_assignment?.teacher_id;
    return teacherIds.map(String).includes(String(teacherIdInAssignment));
  });

  const grouped = {};
  for (const row of filteredRows) {
    const day = row.day_of_week;
    if (!grouped[day]) grouped[day] = [];

    // Calculate status: Upcoming, Ongoing, Completed
    let status = "Upcoming";
    if (currentTimeStr >= row.start_time && currentTimeStr <= row.end_time) {
      status = "Ongoing";
    } else if (currentTimeStr > row.end_time) {
      status = "Completed";
    }

    grouped[day].push({
      id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      is_break: row.is_break,
      title: row.is_break ? row.title : null,
      class_id: row.class_id,
      section_id: row.section_id,
      class: row.class,
      section: row.section,
      period_number: periodNumberMap.get(row.id) || "P",
      status,
      teacher_assignment_id: row.teacher_assignment?.id ?? null,
      teacher_id: row.teacher_assignment?.teacher_id ?? null,
      subject_id: row.teacher_assignment?.subject_id ?? null,
      subject: row.is_break ? null : row.teacher_assignment?.subject,
      teacher: row.teacher_assignment?.teacher?.user
        ? { id: row.teacher_assignment.teacher.id, name: row.teacher_assignment.teacher.user.name }
        : null,
    });
  }

  return grouped;
};
