import { z } from "zod";

/* admin / teacher: create announcement */
export const createNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),

  target_role: z.enum(["teacher", "parent", "student", "all"]),

  class_id: z.number().int().positive().optional(),
  section_id: z.number().int().positive().optional(),
  category: z.enum([
    "Attendance", "Homework", "Diary", "Exam", "Fees", "Leave", 
    "Circular", "Announcement", "Event", "Profile Update", "General", "System"
  ]).optional(),
  priority_level: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  module_reference: z.string().optional(),
});

export const updateNotificationSchema = z.object({
  title: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  target_role: z.enum(["teacher", "parent", "student", "all"]).optional(),
  class_id: z.number().int().positive().optional().nullable(),
  section_id: z.number().int().positive().optional().nullable(),
  category: z.enum([
    "Attendance", "Homework", "Diary", "Exam", "Fees", "Leave", 
    "Circular", "Announcement", "Event", "Profile Update", "General", "System"
  ]).optional(),
  priority_level: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  module_reference: z.string().optional(),
});
/* parent / teacher: acknowledge */
export const acknowledgeNotificationSchema = z.object({});
