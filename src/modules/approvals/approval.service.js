import { getPagination } from "../../shared/utils/pagination.js";
import { Op } from "sequelize";
import AppError from "../../shared/appError.js";

import Student from "../students/student.model.js";
import Teacher from "../teachers/teacher.model.js";
import Parent from "../parents/parent.model.js";
import User from "../users/user.model.js";
import TeacherAssignment from "../teacher-assignments/teacher-assignment.model.js";
import Class from "../classes/classes.model.js";
import Section from "../sections/section.model.js";
import { resolveTeacherId } from "../../shared/utils/resolveTeacherId.js";

const resolveSchoolId = (school_id, user) => {
  const resolved = school_id ?? user?.school_id;
  if (!resolved) {
    throw new AppError("school_id is required", 400);
  }
  return resolved;
};

/* =========================
   TEACHER: STUDENT PENDING
========================= */
export const getPendingStudentApprovalsService = async ({
  school_id,
  user,
  class_id,
  query,
}) => {
  const scopedSchoolId = resolveSchoolId(school_id, user);
  const { limit, offset } = getPagination(query);
  const safeQuery = query || {};
  const { from_date, to_date } = safeQuery;

  const where = {
    school_id: scopedSchoolId,
    approval_status: "pending",
  };

  if (user?.role === "teacher") {
    const resolvedTeacherId = user.teacher_id ?? (await resolveTeacherId(user));
    if (!resolvedTeacherId) {
      return { count: 0, rows: [] };
    }

    const assignments = await TeacherAssignment.findAll({
      where: {
        school_id: scopedSchoolId,
        teacher_id: resolvedTeacherId,
        is_class_teacher: true,
        is_active: true,
      },
      attributes: ["class_id", "section_id"],
    });

    if (!assignments.length) {
      return { count: 0, rows: [] };
    }

    const allowedClassIds = [
      ...new Set(assignments.map((a) => a.class_id)),
    ];
    const allowedSectionIds = [
      ...new Set(assignments.map((a) => a.section_id)),
    ];

    if (class_id && !allowedClassIds.includes(Number(class_id))) {
      return { count: 0, rows: [] };
    }

    where.section_id = { [Op.in]: allowedSectionIds };
  }

  if (class_id) {
    where.class_id = Number(class_id);
  }

  if (from_date || to_date) {
    where.updated_at = {};
    if (from_date) where.updated_at[Op.gte] = new Date(from_date);
    if (to_date) where.updated_at[Op.lte] = new Date(to_date);
  }

  return Student.findAndCountAll({
    where,
    limit,
    offset,
    order: [["updated_at", "DESC"]],
    include: [
      {
        model: User,
        attributes: ["id", "name", "username", "email", "phone"],
      },
      { model: Class, attributes: ["id", "class_name"] },
      { model: Section, attributes: ["id", "name"] },
    ],
  });
};

/* =========================
   TEACHER: PARENT PENDING (CLASS TEACHER ONLY)
========================= */
export const getPendingParentApprovalsForTeacherService = async ({
  school_id,
  user,
  query,
}) => {
  const scopedSchoolId = resolveSchoolId(school_id, user);
  const { limit, offset } = getPagination(query);
  const safeQuery = query || {};
  const { from_date, to_date } = safeQuery;

  const resolvedTeacherId = user?.teacher_id ?? (await resolveTeacherId(user));
  if (!resolvedTeacherId) {
    return { count: 0, rows: [] };
  }

  const classTeacherAssignments = await TeacherAssignment.findAll({
    where: {
      school_id: scopedSchoolId,
      teacher_id: resolvedTeacherId,
      is_class_teacher: true,
      is_active: true,
    },
    attributes: ["section_id"],
  });

  if (!classTeacherAssignments.length) {
    return { count: 0, rows: [] };
  }

  const allowedSectionIds = [
    ...new Set(classTeacherAssignments.map((a) => a.section_id).filter(Boolean)),
  ];
  if (!allowedSectionIds.length) {
    return { count: 0, rows: [] };
  }

  const where = {
    approval_status: "pending",
  };

  if (from_date || to_date) {
    where.created_at = {};
    if (from_date) where.created_at[Op.gte] = new Date(from_date);
    if (to_date) where.created_at[Op.lte] = new Date(to_date);
  }

  return Parent.findAndCountAll({
    where,
    include: [
      {
        model: User,
        required: true,
        where: { school_id: scopedSchoolId },
        attributes: ["id", "name", "username", "email", "phone"],
      },
      {
        model: Student,
        required: true,
        where: { school_id: scopedSchoolId, section_id: { [Op.in]: allowedSectionIds } },
        include: [
          { model: User, attributes: ["id", "name", "username"] },
          { model: Class, attributes: ["id", "class_name"] },
          { model: Section, attributes: ["id", "name"] },
        ],
      },
    ],
    limit,
    offset,
    distinct: true,
    order: [["updated_at", "DESC"]],
  });
};

/* =========================
   ADMIN: TEACHER PENDING
========================= */
export const getPendingTeacherApprovalsService = async ({
  school_id,
  user,
  query,
}) => {
  const scopedSchoolId = resolveSchoolId(school_id, user);
  const { limit, offset } = getPagination(query);
  const safeQuery = query || {};
  const { from_date, to_date } = safeQuery;

  const where = {
    school_id: scopedSchoolId,
    approval_status: "pending",
  };

  if (from_date || to_date) {
    where.updated_at = {};
    if (from_date) where.updated_at[Op.gte] = new Date(from_date);
    if (to_date) where.updated_at[Op.lte] = new Date(to_date);
  }

  return Teacher.findAndCountAll({
    where,
    limit,
    offset,
    order: [["updated_at", "DESC"]],
  });
};

/* =========================
   ADMIN: PARENT PENDING
========================= */
export const getPendingParentApprovalsService = async ({
  school_id,
  user,
  query,
}) => {
  const scopedSchoolId = resolveSchoolId(school_id, user);
  const { limit, offset } = getPagination(query);
  const safeQuery = query || {};
  const { from_date, to_date } = safeQuery;

  const where = {
    approval_status: "pending",
  };

  if (from_date || to_date) {
    where.created_at = {};
    if (from_date) where.created_at[Op.gte] = new Date(from_date);
    if (to_date) where.created_at[Op.lte] = new Date(to_date);
  }

  return Parent.findAndCountAll({
    where,
    include: [
      {
        model: User,
        required: true,
        where: { school_id: scopedSchoolId }, // FIXED: school scoped
        attributes: ["id", "name", "username", "email", "phone"],
      },
      {
        model: Student,
        include: [
          { model: User, attributes: ["id", "name", "username"] },
          { model: Class, attributes: ["id", "class_name"] },
          { model: Section, attributes: ["id", "name"] },
        ],
      },
    ],
    limit,
    offset,
    distinct: true,
    order: [["updated_at", "DESC"]],
  });
};

/* =========================
   ACTION: APPROVE / REJECT
========================= */
export const processApprovalAction = async ({
  user,
  type,
  id,
  action,
  rejection_reason,
}) => {
  const normalizedType = (() => {
    if (!type) return "";
    if (type === "student_profile") return "student";
    if (type === "parent_profile") return "parent";
    if (type === "teacher_profile") return "teacher";
    return type;
  })();

  // 1. Validate Action
  if (!["approve", "reject"].includes(action)) {
    throw new AppError("Invalid action", 400);
  }
  const status = action === "approve" ? "approved" : "rejected";

  // 2. Determine Target Model
  let Model;
  if (normalizedType === "student") Model = Student;
  else if (normalizedType === "teacher") Model = Teacher;
  else if (normalizedType === "parent") Model = Parent;
  else throw new AppError("Invalid approval type", 400);

  // 3. Find Entity
  const include =
    normalizedType === "parent"
      ? [
          { model: User, attributes: ["school_id"] },
          { model: Student, attributes: ["id", "section_id", "school_id"] },
        ]
      : undefined;

  const normalizedId = Number(id);
  let entity;

  if (normalizedType === "student" || normalizedType === "teacher") {
    // Accept either profile-table id OR linked user_id to avoid frontend id-shape mismatch.
    entity = await Model.findOne({
      where: {
        school_id: user.school_id,
        [Op.or]: [{ id: normalizedId }, { user_id: normalizedId }],
      },
      ...(include ? { include } : {}),
    });
  } else {
    entity = await Model.findByPk(id, include ? { include } : undefined);
  }

  if (!entity) throw new AppError("Entity not found", 404);

  const entitySchoolId =
    normalizedType === "parent" ? (entity.user ?? entity.User)?.school_id : entity.school_id;

  // 4. Permission Check (CRITICAL)
  if (user.role === "teacher") {
    if (String(entitySchoolId) !== String(user.school_id)) {
      throw new AppError("Unauthorized", 403);
    }

    const resolvedTeacherId = user.teacher_id ?? (await resolveTeacherId(user));
    if (!resolvedTeacherId) {
      throw new AppError("Teacher profile not found", 403);
    }

    if (normalizedType === "student") {
      const sectionId = entity.section_id ?? null;
      const classId = entity.class_id ?? null;

      if (!sectionId && !classId) {
        throw new AppError("Student class/section missing", 403);
      }

      const assignmentWhere = {
        school_id: user.school_id,
        teacher_id: resolvedTeacherId,
        is_class_teacher: true,
        is_active: true,
      };

      // Class teacher is defined at section level; fallback to class only if needed.
      if (sectionId) assignmentWhere.section_id = sectionId;
      else if (classId) assignmentWhere.class_id = classId;

      const hasClassTeacherAssignment = await TeacherAssignment.findOne({
        where: assignmentWhere,
      });

      if (!hasClassTeacherAssignment) {
        throw new AppError("Only class teacher can approve this student", 403);
      }
    }

    if (normalizedType === "parent") {
      const linkedStudent = entity.student ?? entity.Student;
      if (!linkedStudent) {
        throw new AppError("Parent linked student not found", 404);
      }

      const hasClassTeacherAssignment = await TeacherAssignment.findOne({
        where: {
          school_id: user.school_id,
          teacher_id: resolvedTeacherId,
          section_id: linkedStudent.section_id,
          is_class_teacher: true,
          is_active: true,
        },
      });

      if (!hasClassTeacherAssignment) {
        throw new AppError("Only class teacher can approve this parent", 403);
      }
    }
  }

  if (user.role === "school_admin") {
    if (String(entitySchoolId) !== String(user.school_id)) {
      throw new AppError("Unauthorized", 403);
    }
  }

  // 5. Update Status
  await entity.update({
    approval_status: status,
    approved_by: user.id,
    approved_at: new Date(),
    rejection_reason: action === "reject" ? (rejection_reason || null) : null
  });

  return entity;
};
