import jwt from "jsonwebtoken";
import asyncHandler from "../../shared/asyncHandler.js";
import AppError from "../../shared/appError.js";
import User from "../users/user.model.js";
import School from "../schools/school.model.js";
import Parent from "../parents/parent.model.js";

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body; // already validated by Zod
  const loginUsername = String(username || "").trim();

  let user = await User.findOne({
    where: { username: loginUsername },
  });





// export const login = asyncHandler(async (req, res) => {

//   // ✅ TEMP DEV LOGIN (DO NOT REMOVE REAL CODE BELOW)
//   if (process.env.DEV_LOGIN === "true") {

//   const devToken = jwt.sign(
//     {
//       id: 3,
//       role: "student",
//       school_id: 1
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: "7d" }
//   );

//   return res.status(200).json({
//     message: "Dev login success",
//     token: devToken
//   });
// }




  // Bootstrap super admin on first login if env credentials are configured
  if (!user && loginUsername && password) {
    const envSuperUsername = process.env.SUPER_ADMIN_USERNAME;
    const envSuperPassword = process.env.SUPER_ADMIN_PASSWORD;
    const isSuperAdminLogin =
      loginUsername === envSuperUsername && password === envSuperPassword;

    if (isSuperAdminLogin) {
      const existingSuperAdmin = await User.findOne({
        where: { role: "super_admin" },
      });

      if (!existingSuperAdmin) {
        user = await User.create({
          role: "super_admin",
          username: envSuperUsername,
          password: envSuperPassword,
          name: "Super Admin",
          is_active: true,
          first_login: false,
        });
      }
    }
  }
    // check user exists
  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  // password check
  const isMatch = password === user.password;

  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  // if (!user) {
  //   throw new AppError("User not found", 401);
  // }

  // if (!user.is_active) {
  //   throw new AppError("User account disabled", 403);
  // }

  // if (password !== user.password) {
  //   throw new AppError("Password is wrong", 401);
  // }

  // school check (except super admin)
  if (user.role !== "super_admin") {
    const school = await School.findByPk(user.school_id);
    if (!school || school.status !== "active") {
      throw new AppError("School is inactive", 403);
    }
  }

  if (user.role === "parent") {
    const parentLinks = await Parent.findAll({
      where: { user_id: user.id },
      attributes: ["approval_status"],
    });

    const hasApprovedLink = parentLinks.some(
      (link) => link.approval_status === "approved"
    );

    if (!hasApprovedLink) {
      const hasRejectedLink = parentLinks.some(
        (link) => link.approval_status === "rejected"
      );
      throw new AppError(
        hasRejectedLink
          ? "Parent account rejected. Please contact your school admin."
          : "Parent account pending approval. Please contact your school admin.",
        403
      );
    }
  }

  // For students, fetch class/section info
  let additionalClaims = {};
  if (user.role === "student") {

    const Student = (await import("../students/student.model.js")).default;
    const student = await Student.findOne({ where: { user_id: user.id } });

    if (student) {
      additionalClaims = {
        class_id: student.class_id,
        section_id: student.section_id,
        student_id: student.id
      };
    }
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      school_id: user.school_id,
      ...additionalClaims
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body;

  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (old_password !== user.password) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.password = new_password;
  await user.save();

  res.json({
    message: "Password updated successfully",
  });
});
