import express from "express";
import multer from "multer";
import { authenticateToken } from "./userAuth.js";
import {
  signUp,
  signIn,
  getUserInfo,
  updateAddress,
} from "../controllers/userController.js";
import { updateAvatar } from "../controllers/userController.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/sign-up", upload.single("avatar"), signUp);
router.put(
  "/update-avatar",
  authenticateToken,
  upload.single("avatar"),
  updateAvatar
);
router.post("/sign-in", signIn);
router.get("/get-user-information", authenticateToken, getUserInfo);
router.put("/update-address", authenticateToken, updateAddress);

export default router;
