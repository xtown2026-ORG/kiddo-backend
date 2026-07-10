import Notification from "./notification.model.js";
import NotificationAck from "./notification-ack.model.js";
import AppError from "../../shared/appError.js";
import { Op } from "sequelize";
import User from "../users/user.model.js";
import School from "../schools/school.model.js";

export const createNotificationService = async ({
  school_id,
  sender_user_id,
  sender_role,
  title,
  message,
  target_role,
  target_user_id,
  class_id,
  section_id,
}) => {
  /* Role enforcement */
  if (sender_role === "teacher" && target_role === "teacher") {
    throw new AppError("Teachers cannot notify other teachers", 403);
  }

  if (sender_role !== "school_admin" && sender_role !== "teacher") {
    throw new AppError("Not allowed to send notifications", 403);
  }

  const notification = await Notification.create({
    school_id,
    sender_user_id,
    sender_role,
    title,
    message,
    target_role,
    target_user_id,
    class_id,
    section_id,
  });

  return notification;
};


export const listNotificationsForUserService = async ({
  school_id,
  user_role,
  user_id,
  class_ids = [],
  section_ids = [],
}) => {
  const baseWhere = { school_id };

  if (user_role !== "school_admin" && user_role !== "super_admin") {
    const roleTargets = [user_role, "all"];
    const audienceFilter = { target_role: { [Op.in]: roleTargets } };

    const scopeConditions = [{ class_id: null }];
    if (class_ids.length) scopeConditions.push({ class_id: { [Op.in]: class_ids } });
    if (section_ids.length) scopeConditions.push({ section_id: { [Op.in]: section_ids } });

    const scopedAudienceWhere = {
      [Op.and]: [
        audienceFilter, 
        { [Op.or]: scopeConditions },
        { sender_user_id: { [Op.ne]: user_id } }, // Hide notifications sent by the user themselves
        {
          [Op.or]: [
            { target_user_id: null },
            { target_user_id: user_id }
          ]
        }
      ],
    };

    baseWhere[Op.and] = scopedAudienceWhere[Op.and];
  }

  return Notification.findAndCountAll({
    where: baseWhere,
    include: [
      {
        model: User,
        attributes: ["id", "name", "avatar_url", "role"],
        required: false,
      },
      {
        model: School,
        attributes: ["id", "school_name", "logo_url"],
        required: false,
      },
      {
        model: NotificationAck,
        attributes: ["id", "user_id", "acknowledged_at"],
        required: false,
        where: { user_id },
        separate: true,
      },
    ],
    order: [["created_at", "DESC"]],
  });
};

export const updateNotificationService = async (id, payload, user_id, user_role) => {
  const notification = await Notification.findByPk(id);
  if (!notification) throw new AppError("Notification not found", 404);

  if (user_role === "teacher" && notification.sender_user_id !== user_id) {
    throw new AppError("Not authorized to update this notification", 403);
  }

  await notification.update(payload);
  return notification;
};

export const deleteNotificationService = async (id, user_id, user_role) => {
  const notification = await Notification.findByPk(id);
  if (!notification) throw new AppError("Notification not found", 404);

  if (user_role === "teacher" && notification.sender_user_id !== user_id) {
    throw new AppError("Not authorized to delete this notification", 403);
  }

  await notification.destroy();
  return true;
};
