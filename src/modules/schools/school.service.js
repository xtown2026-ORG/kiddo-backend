import School from "./school.model.js";
import User from "../users/user.model.js";
import AppError from "../../shared/appError.js";
import { getPagination } from "../../shared/utils/pagination.js";
import fs from "fs";
import path from "path";

export const SCHOOLS_UPLOAD_DIR = path.join(process.cwd(), "uploads", "schools");
if (!fs.existsSync(SCHOOLS_UPLOAD_DIR)) {
  fs.mkdirSync(SCHOOLS_UPLOAD_DIR, { recursive: true });
}

/* =========================
   SUPER ADMIN: CREATE SCHOOL
========================= */
export const createSchoolService = async ({
  name,
  code,
  school_type,
  cbse_affiliation_no,
  address,
  city,
  state,
  zip,
  email,
  payment_mode,
  reference_name,
  reference_percentage,
  admin_username,
  admin_password,
}) => {
  const exists = await School.findOne({
    where: { school_code: code },
  });

  if (exists) {
    throw new AppError("School code already exists", 409);
  }
  if (school_type === "cbse" && !cbse_affiliation_no) {
    throw new AppError(
      "CBSE affiliation number is required for CBSE schools",
      400
    );
  }

  if (school_type === "state") {
    cbse_affiliation_no = null;
  }

  const school = await School.create({
    school_name: name,
    school_code: code,
    school_type,
    cbse_affiliation_no,
    address,
    city,
    state,
    zip,
    email,
    payment_mode,
    reference_name,
    reference_percentage,
    status: "pending",
  });

  const existingUser = await User.findOne({
  where: { username: admin_username },
});

if (existingUser) {
  throw new AppError("Admin username already exists", 409);
}

  const admin = await User.create({
    role: "school_admin",
    school_id: school.id,
    username: admin_username,
    email: email,
    password: admin_password,
    first_login: true,
    is_active: true,
    name: "School Admin",
  });

  return {
    school,
    admin: { username: admin.username },
  };
};

/* =========================
   SUPER ADMIN: LIST SCHOOLS
========================= */
export const listSchoolsService = async ({ query }) => {
  const { limit, offset } = getPagination(query);
  const result = await School.findAndCountAll({
    limit,
    offset,
    order: [["id", "ASC"]],
  });

  const schoolIds = result.rows.map((s) => s.id);
  let admins = [];

  if (schoolIds.length) {
    admins = await User.findAll({
      where: { role: "school_admin", school_id: schoolIds },
      attributes: ["id", "school_id", "username", "is_active", "first_login", "password"],
      order: [["school_id", "ASC"], ["id", "ASC"]],
    });
  }

  const adminMap = new Map();
  for (const admin of admins) {
    const key = String(admin.school_id);
    if (!adminMap.has(key)) adminMap.set(key, []);
    adminMap.get(key).push(admin);
  }

  const rows = result.rows.map((school) => {
    const plain = school.get({ plain: true });
    plain.users = adminMap.get(String(school.id)) || [];
    return plain;
  });

  return {
    count: result.count,
    rows,
  };
};

/* =========================
   SUPER ADMIN: UPDATE SCHOOL STATUS
========================= */
export const updateSchoolStatusService = async ({ school_id, status }) => {
  const school = await School.findByPk(school_id);
  if (!school) {
    throw new AppError("School not found", 404);
  }

  school.status = status;
  await school.save();
  return school;
};

/* =========================
   SUPER ADMIN: SCHOOL ADMIN STATUS
========================= */
export const updateSchoolAdminStatusService = async ({
  school_id,
  is_active,
}) => {
  const admin = await User.findOne({
    where: { school_id, role: "school_admin" },
  });

  if (!admin) {
    throw new AppError("School admin not found", 404);
  }

  admin.is_active = is_active;
  await admin.save();
  return admin;
};

/* =========================
   SUPER ADMIN: RESET ADMIN PASSWORD
========================= */
export const resetSchoolAdminPasswordService = async ({
  school_id,
  new_password,
}) => {
  const admin = await User.findOne({
    where: { school_id, role: "school_admin" },
  });

  if (!admin) {
    throw new AppError("School admin not found", 404);
  }

  admin.password = new_password;
  admin.first_login = true;
  await admin.save();

  return { username: admin.username };
};

/* =========================
   SCHOOL DETAILS
========================= */
export const getSchoolDetailsService = async ({ requester, school_id }) => {
  const requestedId = Number(school_id);
  if (!Number.isFinite(requestedId)) {
    throw new AppError("Invalid school id", 400);
  }

  if (
    requester.role === "school_admin" &&
    String(requester.school_id) !== String(requestedId)
  ) {
    throw new AppError("Forbidden", 403);
  }

  const school = await School.findByPk(requestedId);
  if (!school) {
    throw new AppError("School not found", 404);
  }

  return school;
};

/* =========================
   SCHOOL BRANDING
========================= */
export const updateSchoolBrandingService = async ({ school_id, school_name, logo_file }) => {
  const school = await School.findByPk(school_id);
  if (!school) {
    throw new AppError("School not found", 404);
  }

  const updateData = {};
  if (school_name) {
    updateData.school_name = school_name;
  }

  if (logo_file) {
    const ext = path.extname(logo_file.originalname) || ".png";
    const filename = `logo_${school_id}_${Date.now()}${ext}`;
    const filepath = path.join(SCHOOLS_UPLOAD_DIR, filename);

    fs.writeFileSync(filepath, logo_file.buffer);

    // Provide a relative path for the static server
    updateData.logo_url = `/uploads/schools/${filename}?v=${Date.now()}`;
  }

  if (Object.keys(updateData).length > 0) {
    await school.update(updateData);
  }

  return school;
};
