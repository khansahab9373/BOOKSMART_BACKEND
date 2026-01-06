import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import streamifier from "streamifier";
import cloudinary from "../conn/cloudinary.js";

// Sign Up
export const signUp = async (req, res) => {
  try {
    const { username, email, password, address } = req.body;

    if (username.length < 4) {
      return res
        .status(400)
        .json({ message: "Username length should be greater than 3" });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    if (password.length <= 5) {
      return res
        .status(400)
        .json({ message: "Password's length should be greater than 5" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // default avatar stays in schema; override if user uploaded a file
    let avatarUrl = undefined;
    let avatarPublicId = undefined;
    if (req.file && req.file.buffer) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "users_avatars" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
      });
      avatarUrl = uploadResult.secure_url;
      avatarPublicId = uploadResult.public_id;
    }

    const newUserData = {
      username,
      email,
      password: hashedPassword,
      address,
    };
    if (avatarUrl) {
      newUserData.avatar = avatarUrl;
      newUserData.avatarPublicId = avatarPublicId;
    }

    const newUser = new User(newUserData);
    await newUser.save();

    res.status(200).json({ message: "Sign-up successful" });
  } catch (error) {
    console.error("SignUp error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Sign In
export const signIn = async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (!existingUser) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (isPasswordValid) {
      const authClaims = [
        { name: existingUser.username },
        { role: existingUser.role },
      ];
      const token = jwt.sign({ authClaims }, "bookstore123", {
        expiresIn: "30d",
      });

      return res.status(200).json({
        id: existingUser.id,
        role: existingUser.role,
        token,
      });
    } else {
      return res.status(400).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get User Info
export const getUserInfo = async (req, res) => {
  try {
    const { id } = req.headers;
    const data = await User.findById(id).select("-password");
    return res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Address
export const updateAddress = async (req, res) => {
  try {
    const { id } = req.headers;
    const { address } = req.body;
    await User.findByIdAndUpdate(id, { address });
    return res.status(200).json({ message: "Address updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Avatar
export const updateAvatar = async (req, res) => {
  try {
    const { id } =
      req.user && req.user.authClaims ? req.user.authClaims[0] : { name: null };
    // Fallback to header id if JWT payload format differs
    const userId = req.headers.id || (req.user && req.user.id) || id;

    if (!userId) return res.status(400).json({ message: "User id required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No avatar file provided" });
    }

    // Upload new image
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "users_avatars" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

    // delete old image from Cloudinary if public id exists
    if (user.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      } catch (err) {
        console.warn("Failed to delete old avatar from Cloudinary:", err);
      }
    }

    // update user
    user.avatar = uploadResult.secure_url;
    user.avatarPublicId = uploadResult.public_id;
    await user.save();

    return res
      .status(200)
      .json({ message: "Avatar updated successfully", avatar: user.avatar });
  } catch (error) {
    console.error("updateAvatar error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
