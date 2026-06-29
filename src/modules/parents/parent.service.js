import db from "../../config/db.js";
import { Op } from "sequelize";
import User from "../users/user.model.js";
import Parent from "./parent.model.js";
import Student from "../students/student.model.js";
import AppError from "../../shared/appError.js";
import { getPagination } from "../../shared/utils/pagination.js";
import { resolveParentFamilyUserIds } from "./parent.family.service.js";

/* =========================
   ADMIN: CREATE PARENT + LINK
========================= */
export const createParentAndLinkService = async ({
  school_id,
  student_id,
  relation_type = "guardian",
}) => {
  if (!student_id) {
    throw new AppError("student_id is required", 400);
  }
  


  return db.transaction(async (t) => {
    /**
     * 1️⃣ Validate student
     */
    const student = await Student.findOne({
      where: { id: student_id, school_id },
      transaction: t,
    });

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    /**
     * 2️⃣ Generate deterministic username
     */
    const username = `PAR-${school_id}-${student_id}`;
    const password = `${username}@123`;

    /**
     * 3️⃣ Ensure parent user does not already exist
     */
    const existingUser = await User.findOne({
      where: { school_id, username },
      transaction: t,
    });

    if (existingUser) {
      throw new AppError("Parent already exists for this student", 409);
    }

    /**
     * 4️⃣ Create parent user
     */
    const user = await User.create(
      {
        role: "parent",
        school_id,
        username,
        password,
        first_login: true,
        is_active: true,
        name: "Parent",
      },
      { transaction: t }
    );

    /**
     * 5️⃣ Create parent profile + link
     */
    const parent = await Parent.create(
      {
        user_id: user.id,
        student_id,
        relation_type,
        approval_status: "pending",
        is_active: true,
      },
      { transaction: t }
    );

    /**
     * 6️⃣ Return admin-safe response
     */
    return {
      parent_id: parent.id,
      username,
      student_id,
      relation_type,
      password_hint: "username@123",
    };
  });
};
/* =========================
   ADMIN: LINK EXISTING PARENT
========================= */
export const linkExistingParentService = async ({
  parent_user_id,
  student_id,
  relation_type = "guardian",
  school_id,
}) => {

  return db.transaction(async (t) => {
    const user = await User.findOne({
      where: { id: parent_user_id, role: "parent", school_id },
      transaction: t,
    });

    if (!user) throw new AppError("Parent user not found", 404);

    const student = await Student.findOne({
      where: { id: student_id, school_id },
      transaction: t,
    });

    if (!student) throw new AppError("Student not found", 404);

    const exists = await Parent.findOne({
      where: { user_id: user.id, student_id },
      transaction: t,
    });

    if (exists) {
      throw new AppError("Parent already linked to this student", 409);
    }

    await Parent.create(
      {
        user_id: user.id,
        student_id,
        relation_type,
      },
      { transaction: t }
    );

    return { parent_user_id, student_id };
  });
};

/* =========================
   PARENT: UPDATE OWN PROFILE
========================= */
export const updateParentProfileService = async (user_id, data) => {
  const user = await User.findByPk(user_id);

  if (!user || user.role !== "parent") {
    throw new AppError("Parent not found", 404);
  }

  let sharedLinkedStudentPhone = false;

  if (data?.phone) {
    const existingPhoneUser = await User.findOne({
      where: {
        phone: data.phone,
        id: { [Op.ne]: user_id },
      },
      attributes: ["id", "role", "school_id"],
    });

    if (existingPhoneUser) {
      const familyUserIds = await resolveParentFamilyUserIds({
        parent_user_id: user_id,
        school_id: user.school_id,
      });

      if (
        ["parent", "teacher", "student"].includes(existingPhoneUser.role) &&
        Number(existingPhoneUser.school_id) === Number(user.school_id)
      ) {
        sharedLinkedStudentPhone = true;
      }

      const links = await Parent.findAll({
        where: {
          user_id:
            familyUserIds.length > 1
              ? { [Op.in]: familyUserIds }
              : familyUserIds[0] || user_id,
        },
        attributes: ["student_id"],
      });

      const linkedStudentIds = links
        .map((link) => Number(link.student_id))
        .filter(Boolean);

      let allowedLinkedStudent = false;

      if (linkedStudentIds.length > 0) {
        const linkedStudents = await Student.findAll({
          where: {
            id: { [Op.in]: linkedStudentIds },
          },
          attributes: ["id", "user_id"],
        });

        allowedLinkedStudent = linkedStudents.some(
          (student) => Number(student.user_id) === Number(existingPhoneUser.id)
        );
      }

      if (!allowedLinkedStudent && !sharedLinkedStudentPhone) {
        throw new AppError("Phone already in use", 400);
      }

      sharedLinkedStudentPhone = sharedLinkedStudentPhone || allowedLinkedStudent;
    }
  }

  const normalizedRelationType = data?.relation_type;
  const userUpdateData = { ...data };

  delete userUpdateData.relation_type;

  if (sharedLinkedStudentPhone) {
    userUpdateData.phone = null;
  }

  await user.update(userUpdateData);

  const parent = await Parent.findOne({ where: { user_id } });
  if (parent) {
    const parentUpdateData = {
      approval_status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
    };

    if (normalizedRelationType) {
      parentUpdateData.relation_type = normalizedRelationType;
    }

    await parent.update(parentUpdateData);
  }
  return user;
};

/* =========================
   ADMIN: LIST PARENTS (SCHOOL)
========================= */
export const listParentsService = async ({ school_id, query }) => {
  const { limit, offset } = getPagination(query);
  const safeQuery = query || {};

  const where = {};
  const studentWhere = { school_id };

  const status = safeQuery.approval_status;
  if (["pending", "approved", "rejected"].includes(status)) {
    where.approval_status = status;
  }

  if (safeQuery.class_id) {
    studentWhere.class_id = Number(safeQuery.class_id);
  }

  if (safeQuery.section_id) {
    studentWhere.section_id = Number(safeQuery.section_id);
  }

  return Parent.findAndCountAll({
    where,
    include: [
      {
        model: User,
        required: true,
        where: { school_id },
        attributes: ["id", "username", "name", "phone", "is_active"],
      },
      {
        model: Student,
        required: true,
        where: studentWhere,
        attributes: ["id", "class_id", "section_id", "user_id"],
        include: [
          {
            model: User,
            required: true,
            attributes: ["id", "username", "name", "is_active"],
          },
        ],
      },
    ],
    limit,
    offset,
    distinct: true,
    order: [["created_at", "DESC"]],
  });
};

/* =========================
   ADMIN: PARENT OPTIONS
========================= */
export const listParentOptionsService = async ({ school_id }) => {
  return User.findAll({
    where: { school_id, role: "parent" },
    attributes: ["id", "username", "name", "phone", "is_active"],
    order: [["username", "ASC"]],
  });
};
