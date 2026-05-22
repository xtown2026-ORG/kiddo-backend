import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();

import db from "./src/config/db.js";
import errorHandler from "./src/shared/errorHandler.js";
import "./src/models/initModels.js";

// socket
import { createServer } from "http";
import { Server } from "socket.io";
import { initGameSocket } from "./src/socket/game.socket.js";
import { initGroupChatSocket } from "./src/socket/group-chat.socket.js";
import { initNotificationSocket } from "./src/socket/notification.socket.js";


const app = express();
const PORT = process.env.PORT || 3003;
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5176",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5176",
  "https://adminpanel.xtown.in",
  "https://kiddoerp.xtown.in",
  "https://school.xtown.in",
  "http://192.168.1.16:5173",
  "http://192.168.1.16:5173/",
  "http://192.168.1.6:5174",
  "http://192.168.1.6:5174/",
  "http://192.168.1.4:5174",
  "http://192.168.1.4:5176",
  "http://192.168.1.34:5174"
];


//env validation
// const requiredEnv = ['TTS_SERVICE_URL'];

// for (const key of requiredEnv) {
//   if (!process.env[key]) {
//     throw new Error(`Missing required env: ${key}`);
//   }
// }


// HTTP + SOCKET SERVER

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Chat-Language"],
    credentials: true,
  },
});

initGameSocket(io);
initGroupChatSocket(io);
initNotificationSocket(io);

// MIDDLEWARES
app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Chat-Language"],
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(helmet());
app.use(morgan("dev"));


// HEALTH CHECK
app.get("/", (req, res) => {
  res.json({ message: "server is running ;)" });
});


// ROUTES
import authRoutes from "./src/modules/auth/auth.routes.js";
import schoolRoutes from "./src/modules/schools/school.routes.js";
import studentRoutes from "./src/modules/students/student.routes.js";
import teacherRoutes from "./src/modules/teachers/teacher.routes.js";
import parentRoutes from "./src/modules/parents/parent.routes.js";
import sectionRoutes from "./src/modules/sections/section.routes.js";
import subjectRoutes from "./src/modules/subjects/subject.routes.js";
import classRoutes from "./src/modules/classes/classes.routes.js";
import timetableRoutes from "./src/modules/timetables/timetable.routes.js";
import reportCardRoutes from "./src/modules/report-cards/report-card.routes.js";
import examRoutes from "./src/modules/report-cards/exam.routes.js";
import teacherDashboardRoutes from "./src/modules/teachers/teacher-dashboard.routes.js";

import approvalRoutes from "./src/modules/approvals/approval.routes.js";
import teacherApprovalRoutes from "./src/modules/teachers/teacher.approval.routes.js";
import studentApprovalRoutes from "./src/modules/students/student.approval.routes.js";
import parentApprovalRoutes from "./src/modules/parents/parent.approval.routes.js";
import parentDashboardRoutes from "./src/modules/parents/parent.dashboard.routes.js";
import studentDashboardRoutes from "./src/modules/students/student.dashboard.routes.js";
import auditRoutes from "./src/modules/audit/audit.routes.js";

import parentBulkRoutes from "./src/modules/parents/parent.bulk.routes.js";
import teacherBulkRoutes from "./src/modules/teachers/teacher.bulk.routes.js";
import bulkRoutes from "./src/modules/bulk/bulk.routes.js";

import attendanceSummaryRoutes from "./src/modules/attendance/attendance.summary.routes.js";
import attendanceAnalyticsRoutes from "./src/modules/attendance/attendance.analytics.routes.js";

import ragRoutes from "./src/modules/rag/rag.routes.js";

import aiChatRoutes from "./src/modules/ai-chat/ai-chat.routes.js";

import aiFollowupRoutes from "./src/modules/ai-followup/aiFollowup.routes.js";

import teacherAiRoutes from "./src/modules/teacher-ai/teacher-ai.routes.js";
import aiTestAssignmentRoutes from "./src/modules/ai-test-assignments/ai-test-assignment.routes.js";
import aiAnalyticsRoutes from "./src/modules/ai-analytics/ai-analytics.routes.js";
import subscriptionRoutes from "./src/modules/subscriptions/subscription.routes.js";
import tokenRoutes from "./src/modules/tokens/token.routes.js";

// teacher planning & tracking
import teacherAssignmentRoutes from "./src/modules/teacher-assignments/teacher-assignment.routes.js";
import teacherClassSessionRoutes from "./src/modules/teacher-class-sessions/teacher-class-session.routes.js";
import homeworkRoutes from "./src/modules/homework/homework.routes.js";
import notificationRoutes from "./src/modules/notifications/notification.routes.js";
import groupChatRoutes from "./src/modules/group-chat/group-chat.routes.js";
import gameRoutes from "./src/modules/game/game.routes.js";
import quizRoutes from "./src/modules/quiz/quiz.routes.js";
import logicalThinkingRoutes from "./src/modules/logical-thinking/logical-thinking.routes.js";
import scienceExplorationRoutes from "./src/modules/science-exploration/science-exploration.routes.js";
import introCodingRoutes from "./src/modules/intro-coding/intro-coding.routes.js";
import gkBuilderRoutes from "./src/modules/gk-builder/gk-builder.routes.js";
import gamifiedLearningRoutes from "./src/modules/gamified-learning/gamified-learning.routes.js";
import codingAIRoutes from "./src/modules/coding-ai/codingAI.routes.js";
import careerDiscoveryRoutes from "./src/modules/career-discovery/career.routes.js";
import communicationSkillsRoutes from "./src/modules/communication-skills/communication.routes.js";
import scienceMathLearningRoutes from "./src/modules/science-math-learning/scienceMath.routes.js";
import creativeSkillsRoutes from "./src/modules/creative-skills/creative.routes.js";
import competitiveExamRoutes from "./src/modules/competitive-exam/competitive.routes.js";
import questionBankRoutes from "./src/modules/question-bank/questionBank.routes.js";
import careerPathRoutes from "./src/modules/career-path/careerPath.routes.js";
import studyStrategyRoutes from "./src/modules/study-strategy/strategy.routes.js";
import advancedExamRoutes from "./src/modules/advanced-exams/advancedExam.routes.js";
import advancedCodingRoutes from "./src/modules/advanced-coding/advancedCoding.routes.js";
import mentorshipRoutes from "./src/modules/career-mentorship/mentorship.routes.js";
import entrepreneurshipRoutes from "./src/modules/entrepreneurship/entrepreneurship.routes.js";

import paymentLogRoutes from "./src/modules/payment-logs/payment-log.routes.js";
import voiceRoutes from "./src/modules/voice-logs/voice.routes.js";
import mindscopeRoutes from "./src/modules/mindscope/mindscope.routes.js";
import billingRoutes from "./src/modules/billing/billing.routes.js";



// auth
app.use("/api/auth", authRoutes);

// attendance (MOVED UP to prevent teacherRoutes masking)
app.use("/api", attendanceSummaryRoutes);
app.use("/api", attendanceAnalyticsRoutes);
// backward-compatible prefix for attendance routes
app.use("/api/attendance", attendanceSummaryRoutes);
app.use("/api/attendance", attendanceAnalyticsRoutes);

// core
app.use("/api/schools", schoolRoutes);
app.use("/api/students", studentDashboardRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherDashboardRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/report-cards", reportCardRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/payment-logs", paymentLogRoutes);
app.use("/api/mindscope", mindscopeRoutes);
app.use("/api/billing", billingRoutes);

// approvals
app.use("/api", approvalRoutes);
app.use("/api", teacherApprovalRoutes);
app.use("/api", studentApprovalRoutes);
app.use("/api", parentApprovalRoutes);
app.use("/api", parentDashboardRoutes);
app.use("/api", auditRoutes);

// bulk
app.use("/api", parentBulkRoutes);
app.use("/api", teacherBulkRoutes);


// mount admin bulk endpoints (for admin panel)
app.use("/api/bulk", bulkRoutes);

// subscriptions
app.use("/api", subscriptionRoutes);
// tokens (super admin)
app.use("/api", tokenRoutes);

// AI
<<<<<<< HEAD
app.use("/api/ai-chat", aiChatRoutes);
app.use("/api/rag", ragRoutes);
=======
app.use("/api/rag", ragRoutes);
app.use("/api/ai-followup", aiFollowupRoutes);
>>>>>>> 9f28db5d (ai chat update)
app.use("/api", teacherAiRoutes);
app.use("/api", aiTestAssignmentRoutes);
app.use("/api", aiAnalyticsRoutes);

// quiz
app.use("/api/quiz", quizRoutes);

// teacher planning & tracking
app.use("/api/teacher-assignments", teacherAssignmentRoutes);
app.use("/api/teacher-class-sessions", teacherClassSessionRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/group-chat", groupChatRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/logical-thinking", logicalThinkingRoutes);
app.use("/api/science-exploration", scienceExplorationRoutes);
app.use("/api/intro-coding", introCodingRoutes);
app.use("/api/gk-builder", gkBuilderRoutes);
app.use("/api/gamified-learning", gamifiedLearningRoutes);
app.use("/api/coding-ai", codingAIRoutes);
app.use("/api/career-discovery", careerDiscoveryRoutes);
app.use("/api/communication-skills", communicationSkillsRoutes);
app.use("/api/science-math-learning", scienceMathLearningRoutes);
app.use("/api/creative-skills", creativeSkillsRoutes);
app.use("/api/competitive-exam", competitiveExamRoutes);
app.use("/api/question-bank", questionBankRoutes);
app.use("/api/career-path", careerPathRoutes);
app.use("/api/study-strategy", studyStrategyRoutes);
app.use("/api/advanced-exams", advancedExamRoutes);
app.use("/api/advanced-coding", advancedCodingRoutes);
app.use("/api/career-mentorship", mentorshipRoutes);
app.use("/api/entrepreneurship", entrepreneurshipRoutes);


// 404 + ERROR HANDLER
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);


// START SERVER
try {
  await db.authenticate();
  console.log("DB connected");

  await db.sync({ force : false });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server + Socket running on port ${PORT}`);
  });
} catch (err) {
  console.error("DB connection failed", err);
  process.exit(1);
}
