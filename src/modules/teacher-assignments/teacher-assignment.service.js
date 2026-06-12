import TeacherAssignment from "./teacher-assignment.model.js";
import AppError from "../../shared/appError.js";
import { getPagination } from "../../shared/utils/pagination.js";
import { Op } from "sequelize";
import db from "../../config/db.js";
import Teacher from "../teachers/teacher.model.js";
import Class from "../classes/classes.model.js";
import Section from "../sections/section.model.js";
import Subject from "../subjects/subject.model.js";
import User from "../users/user.model.js";


/* CREATE */
export async function assignTeacher({
  schoolId,
  teacherId,
  classId,
  sectionId,
  subjectId,
  isClassTeacher = false,
  academicYear = "2025-2026",
}) {
  return db.transaction(async (transaction) => {
    const [teacher, cls, section, subject] = await Promise.all([
      Teacher.findOne({
        where: {
          school_id: schoolId,
          id: teacherId,
        },
        transaction,
        lock: transaction.LOCK?.SHARE,
      }),
      Class.findOne({ where: { id: classId, school_id: schoolId }, transaction }),
      Section.findOne({
        where: { id: sectionId, class_id: classId, school_id: schoolId, is_active: true },
        transaction,
      }),
      Subject.findOne({ where: { id: subjectId, school_id: schoolId }, transaction }),
    ]);

    if (!teacher) {
      throw new AppError("TEACHER_NOT_FOUND", 404);
    }
    if (!cls) {
      throw new AppError("CLASS_NOT_FOUND", 404);
    }
    if (!section) {
      throw new AppError("SECTION_NOT_FOUND", 404);
    }
    if (!subject) {
      throw new AppError("SUBJECT_NOT_FOUND", 404);
    }

    // Check for existing assignment (same teacher + section + subject in same school)
    // Note: we still do this check for a fast, friendly 409. DB uniqueness also protects against races.
    const exists = await TeacherAssignment.findOne({
      where: {
        school_id: schoolId,
        teacher_id: teacher.id,
        class_id: classId,
        section_id: sectionId,
        subject_id: subjectId,
        academic_year: academicYear,
        is_active: true,
      },
      transaction,
      lock: transaction.LOCK?.UPDATE,
    });

    if (exists) {
      throw new AppError(
        "Teacher already assigned to this subject in this section",
        409
      );
    }

    // If trying to set as class teacher, check if section already has a class teacher
    if (isClassTeacher) {
      const existingClassTeacher = await TeacherAssignment.findOne({
        where: {
          school_id: schoolId,
          section_id: sectionId,
          is_class_teacher: true,
          is_active: true,
        },
        transaction,
        lock: transaction.LOCK?.UPDATE,
      });

      if (existingClassTeacher) {
        throw new AppError(
          "This section already has a class teacher assigned",
          409
        );
      }
    }

    try {
      return await TeacherAssignment.create(
        {
          school_id: schoolId,
          teacher_id: teacher.id,
          class_id: classId,
          section_id: sectionId,
          subject_id: subjectId,
          academic_year: academicYear,
          is_class_teacher: isClassTeacher,
        },
        { transaction }
      );
    } catch (err) {
      if (err?.name === "SequelizeUniqueConstraintError") {
        throw new AppError(
          "Teacher already assigned to this subject in this section",
          409
        );
      }
      throw err;
    }
  });
}

/* LIST ALL (with pagination) */
export async function listAssignments({ schoolId, query }) {
  const { limit, offset } = getPagination(query);

  return TeacherAssignment.findAndCountAll({
    where: {
      school_id: schoolId,
      is_active: true,
    },
    limit,
    offset,
    include: [
      { model: Class, attributes: ["id", "class_name"] },
      { model: Section, attributes: ["id", "name"] },
      { model: Subject, attributes: ["id", "name"] },
      {
        model: Teacher,
        attributes: ["id", "user_id"],
        include: [{ model: User, attributes: ["id", "name", "username"] }],
      },
    ],
    order: [["created_at", "DESC"]],
  });
}

/* LIST BY TEACHER */
export async function getTeacherAssignments({ schoolId, teacherId }) {
  const teacherIds = Array.isArray(teacherId) ? teacherId : [teacherId];
  return TeacherAssignment.findAll({
    where: {
      school_id: schoolId,
      teacher_id: { [Op.in]: teacherIds.filter(Boolean) },
      is_active: true,
    },
    include: [
      { model: Class, attributes: ["id", "class_name"] },
      { model: Section, attributes: ["id", "name"] },
      { model: Subject, attributes: ["id", "name"] },
      {
        model: Teacher,
        attributes: ["id", "user_id"],
        include: [{ model: User, attributes: ["id", "name", "username"] }],
      },
    ],
    order: [["created_at", "DESC"]],
  });
}

/* LIST BY SECTION */
export async function getSectionAssignments({ schoolId, sectionId }) {
  return TeacherAssignment.findAll({
    where: {
      school_id: schoolId,
      section_id: sectionId,
      is_active: true,
    },
    include: [
      { model: Class, attributes: ["id", "class_name"] },
      { model: Section, attributes: ["id", "name"] },
      { model: Subject, attributes: ["id", "name"] },
      {
        model: Teacher,
        attributes: ["id", "user_id"],
        include: [{ model: User, attributes: ["id", "name", "username"] }],
      },
    ],
    order: [["created_at", "DESC"]],
  });
}

/* UPDATE */
export async function updateAssignment({ schoolId, assignmentId, updates }) {
  const assignment = await TeacherAssignment.findOne({
    where: {
      id: assignmentId,
      school_id: schoolId,
    },
  });

  if (!assignment) {
    throw new AppError("Assignment not found", 404);
  }

  const nextTeacherId = updates.teacher_id ?? assignment.teacher_id;
  const nextClassId = updates.class_id ?? assignment.class_id;
  const nextSectionId = updates.section_id ?? assignment.section_id;
  const nextSubjectId = updates.subject_id ?? assignment.subject_id;
  const nextAcademicYear = updates.academic_year ?? assignment.academic_year;

  if (
    updates.teacher_id !== undefined ||
    updates.class_id !== undefined ||
    updates.section_id !== undefined ||
    updates.subject_id !== undefined
  ) {
    const [teacher, cls, section, subject] = await Promise.all([
      Teacher.findOne({
        where: {
          school_id: schoolId,
          id: nextTeacherId,
        },
      }),
      Class.findOne({ where: { id: nextClassId, school_id: schoolId } }),
      Section.findOne({
        where: {
          id: nextSectionId,
          class_id: nextClassId,
          school_id: schoolId,
          is_active: true,
        },
      }),
      Subject.findOne({ where: { id: nextSubjectId, school_id: schoolId } }),
    ]);

    if (!teacher) {
      throw new AppError("TEACHER_NOT_FOUND", 404);
    }
    if (!cls) {
      throw new AppError("CLASS_NOT_FOUND", 404);
    }
    if (!section) {
      throw new AppError("SECTION_NOT_FOUND", 404);
    }
    if (!subject) {
      throw new AppError("SUBJECT_NOT_FOUND", 404);
    }

    const duplicateAssignment = await TeacherAssignment.findOne({
      where: {
        school_id: schoolId,
        teacher_id: teacher.id,
        class_id: nextClassId,
        section_id: nextSectionId,
        subject_id: nextSubjectId,
        academic_year: nextAcademicYear,
        is_active: true,
        id: { [Op.ne]: assignmentId },
      },
    });

    if (duplicateAssignment) {
      throw new AppError(
        "Teacher already assigned to this subject in this section",
        409
      );
    }

    updates.teacher_id = teacher.id;
    updates.class_id = nextClassId;
    updates.section_id = nextSectionId;
    updates.subject_id = nextSubjectId;
  }

  // If trying to set as class teacher, check if target section already has a class teacher
  if (updates.is_class_teacher === true) {
    const existingClassTeacher = await TeacherAssignment.findOne({
      where: {
        school_id: schoolId,
        section_id: nextSectionId,
        is_class_teacher: true,
        is_active: true,
        id: { [Op.ne]: assignmentId }, // Exclude current assignment
      },
    });

    if (existingClassTeacher) {
      throw new AppError(
        "This section already has a class teacher assigned",
        409
      );
    }
  }

  await assignment.update(updates);
  return assignment;
}

/* DELETE (soft delete by setting is_active to false) */
export async function deleteAssignment({ schoolId, assignmentId }) {
  const assignment = await TeacherAssignment.findOne({
    where: {
      id: assignmentId,
      school_id: schoolId,
    },
  });

  if (!assignment) {
    throw new AppError("Assignment not found", 404);
  }

  await assignment.update({ is_active: false });
  return { message: "Assignment deleted successfully" };
}

