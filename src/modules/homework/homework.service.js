import Homework from "./homework.model.js";
import Section from "../sections/section.model.js";
import TeacherAssignment from "../teacher-assignments/teacher-assignment.model.js";
import Subject from "../subjects/subject.model.js";
import Class from "../classes/classes.model.js";
import Parent from "../parents/parent.model.js";
import Student from "../students/student.model.js";
import AppError from "../../shared/appError.js";
import { triggerHomeworkNotification } from "../notifications/notification-trigger.service.js";
import { getPagination } from "../../shared/utils/pagination.js";
import { Op } from "sequelize";
import { listApprovedParentLinks } from "../parents/parent.family.service.js";

export const createHomeworkService = async ({
  user,
  school_id,
  class_id,
  section_id,
  teacher_assignment_id,
  homework_date,
  description,
}) => {
  // 1️⃣ Validate section
  const section = await Section.findOne({
    where: { id: section_id, class_id, school_id, is_active: true },
  });

  if (!section) {
    throw new AppError("SECTION_NOT_FOUND", 404);
  }

  // 2️⃣ Validate teacher assignment
  const assignment = await TeacherAssignment.findOne({
    where: {
      id: teacher_assignment_id,
      school_id,
      class_id,
      section_id,
      is_active: true,
    },
    include: [{ model: Subject }],
  });

  if (!assignment) {
    throw new AppError("INVALID_TEACHER_ASSIGNMENT", 400);
  }

  // 3️⃣ Permission check (teacher must own assignment)
  if (user.role === "teacher" && assignment.teacher_id !== user.teacher_id) {
    throw new AppError("FORBIDDEN", 403);
  }

  // 4️⃣ Create homework
  const homework = await Homework.create({
    school_id,
    class_id,
    section_id,
    teacher_assignment_id: assignment.id,
    subject_id: assignment.subject_id, // derived
    homework_date,
    description,
    created_by: user.id,
  });

  // 5️⃣ Notify
  await triggerHomeworkNotification({
    school_id,
    teacher_user_id: user.id,
    class_id,
    section_id,
    subject_name: assignment.subject?.name,
  });

  return homework;
};
export const listHomeworkService = async ({
  user,
  school_id,
  class_id,
  section_id,
  student_id,
  date,
  created_date,
  query,
}) => {
  const { limit, offset } = getPagination(query);

  const where = { school_id };
  if (date) where.homework_date = date;
  if (created_date) {
    const start = new Date(`${created_date}T00:00:00`);
    const end = new Date(`${created_date}T23:59:59.999`);
    where.created_at = { [Op.between]: [start, end] };
  }

  if (user?.role === "student") {
    where.class_id = user.class_id;
    where.section_id = user.section_id;
  } else if (user?.role === "parent") {
    const links = await listApprovedParentLinks({
      parent_user_id: user.id,
      school_id,
    });

    const student = links
      .map((link) => link.student ?? link.Student)
      .find((item) => {
        if (!item) return false;
        if (!student_id) return true;
        return Number(item.id) === Number(student_id);
      });

    if (!student) {
      return { count: 0, rows: [] };
    }
    where.class_id = student.class_id;
    where.section_id = student.section_id;
  } else if (user?.role === "teacher") {
    const assignments = await TeacherAssignment.findAll({
      where: {
        school_id,
        teacher_id: user.teacher_id,
        is_active: true,
      },
      attributes: ["id", "class_id", "section_id", "is_class_teacher"],
    });

    if (!assignments.length) {
      return { count: 0, rows: [] };
    }

    const assignmentIds = assignments.map((a) => a.id);
    const classTeacherSections = assignments
      .filter((a) => a.is_class_teacher)
      .map((a) => ({
        class_id: a.class_id,
        section_id: a.section_id,
      }));

    if (class_id && section_id) {
      const isClassTeacher = classTeacherSections.some(
        (s) =>
          String(s.class_id) === String(class_id) &&
          String(s.section_id) === String(section_id)
      );

      if (isClassTeacher) {
        where.class_id = class_id;
        where.section_id = section_id;
      } else {
        const allowedAssignmentIds = assignments
          .filter(
            (a) =>
              String(a.class_id) === String(class_id) &&
              String(a.section_id) === String(section_id)
          )
          .map((a) => a.id);

        if (!allowedAssignmentIds.length) {
          return { count: 0, rows: [] };
        }
        where.teacher_assignment_id = { [Op.in]: allowedAssignmentIds };
      }
    } else {
      const orConditions = [];
      if (assignmentIds.length) {
        orConditions.push({ teacher_assignment_id: { [Op.in]: assignmentIds } });
      }
      if (classTeacherSections.length) {
        classTeacherSections.forEach((s) => {
          orConditions.push({
            class_id: s.class_id,
            section_id: s.section_id,
          });
        });
      }

      if (!orConditions.length) {
        return { count: 0, rows: [] };
      }
      where[Op.or] = orConditions;
    }
  } else {
    // school_admin / super_admin: allow optional filters
    if (class_id) where.class_id = class_id;
    if (section_id) where.section_id = section_id;
  }

  return Homework.findAndCountAll({
    where,
    include: [
      { model: Subject, attributes: ["id", "name"] },
      { model: Class, attributes: ["id", "class_name"] },
      { model: Section, attributes: ["id", "name"] },
    ],
    order: [["homework_date", "DESC"], ["created_at", "DESC"]],
    limit,
    offset,
  });
};
