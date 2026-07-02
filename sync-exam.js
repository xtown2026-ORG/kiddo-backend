import dotenv from "dotenv";
dotenv.config();

import db from "./src/config/db.js";
import "./src/models/initModels.js";
import ExamTimetable from "./src/modules/report-cards/exam-timetable.model.js";

const sync = async () => {
    try {
        await ExamTimetable.sync({ force: true });
        console.log("ExamTimetable table created successfully");
    } catch (err) {
        console.error("Failed to sync database", err);
    } finally {
        process.exit();
    }
}
sync();
