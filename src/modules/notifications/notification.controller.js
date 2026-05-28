import asyncHandler from "../../shared/asyncHandler.js";
import {
  createNotificationService,
  listNotificationsForUserService,
} from "./notification.service.js";
import { listApprovedParentLinks } from "../parents/parent.family.service.js";

/* ADMIN / TEACHER: CREATE */
export const createNotification = asyncHandler(async (req, res) => {
  const notification = await createNotificationService({
    school_id: req.user.school_id,
    sender_user_id: req.user.id,
    sender_role: req.user.role,
    ...req.body,
  });

  res.status(201).json({
    success: true,
    data: notification,
  });
});

/* ALL USERS: LIST */
export const listNotifications = asyncHandler(async (req, res) => {
  let classIds = [];
  let sectionIds = [];

  if (req.user.role === "student") {
    if (req.user.class_id) classIds = [req.user.class_id];
    if (req.user.section_id) sectionIds = [req.user.section_id];
  }

  if (req.user.role === "parent") {
    const selectedStudentId = req.query.student_id
      ? Number(req.query.student_id)
      : null;
    const links = await listApprovedParentLinks({
      parent_user_id: req.user.id,
      school_id: req.user.school_id,
    });

    classIds = links
      .filter((link) => {
        if (!selectedStudentId) return true;
        const student = link.student ?? link.Student;
        return Number(student?.id) === selectedStudentId;
      })
      .map((l) => (l.student ?? l.Student)?.class_id)
      .filter((v) => v !== undefined && v !== null);
    sectionIds = links
      .filter((link) => {
        if (!selectedStudentId) return true;
        const student = link.student ?? link.Student;
        return Number(student?.id) === selectedStudentId;
      })
      .map((l) => (l.student ?? l.Student)?.section_id)
      .filter((v) => v !== undefined && v !== null);
  }

  if (req.user.role === "teacher") {
    const TeacherAssignment = (await import("../teacher-assignments/teacher-assignment.model.js")).default;
    const assignments = await TeacherAssignment.findAll({
      where: {
        teacher_id: req.user.teacher_id,
        school_id: req.user.school_id,
        is_active: true,
      },
      attributes: ["class_id", "section_id"],
    });
    classIds = [
      ...classIds,
      ...assignments.map((a) => a.class_id).filter(Boolean),
    ];
    sectionIds = [
      ...sectionIds,
      ...assignments.map((a) => a.section_id).filter(Boolean),
    ];
  }

  const result = await listNotificationsForUserService({
    school_id: req.user.school_id,
    user_role: req.user.role,
    user_id: req.user.id,
    class_ids: classIds,
    section_ids: sectionIds,
  });

  res.json({
    success: true,
    total: result.count,
    items: result.rows.map((row) => {
      const plain = row.toJSON();
      const ack = plain.notification_acks?.[0];
      return {
        ...plain,
        is_acknowledged: Boolean(ack),
        acknowledged_at: ack?.acknowledged_at || null,
        sender: plain.User
          ? {
              id: plain.User.id,
              name: plain.User.name,
              avatar_url: plain.User.avatar_url,
              role: plain.User.role,
            }
          : null,
        school: plain.School
          ? {
              id: plain.School.id,
              school_name: plain.School.school_name,
              logo_url: plain.School.logo_url,
            }
          : null,
      };
    }),
  });
});
