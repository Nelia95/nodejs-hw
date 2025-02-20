const User = require('../models/userModel');
const jsonwebtoken = require('../helper/jsonwebtoken');
const fs = require('fs/promises');
const path = require('path');
const jimp = require('jimp');
const { VERTICAL_ALIGN_MIDDLE } = require('jimp');

const tempDir = path.join(__dirname, '..', 'public', 'avatars');

require('dotenv').config();

const register = async (req, res, next) => {
  const user = await User.getUserByEmail(req.body.email);
  if (user) {
    return res.status(409).json({
      message: 'Email in use',
    });
  }
  try {
    const newUser = await User.createUser(req.body);
    const token = jsonwebtoken.create(newUser.id);
    await User.updateToken(newUser.id, token);

    return res.status(201).json({
      token,
      user: {
        subscription: newUser.subscription,
        email: newUser.email,
        avatarURL: newUser.avatarURL,
      },
    });
  } catch (error) {
    next(error);
  }
};

const logIn = async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.getUserByEmail(email);
  const isValidPassword = await user?.validPassword(password);

  console.log('isValidPassword: ', isValidPassword);
  if (!user || !isValidPassword) {
    return res.status(401).json({
      message: 'Email or password is wrong',
    });
  }

  const token = jsonwebtoken.create(user.id);
  await User.updateToken(user.id, token);

  return res.status(200).json({
    token,
    user: {
      subscription: user.subscription,
      email: user.email,
    },
  });
};

const getCurrent = async (req, res, next) => {
  const { user } = req;
  if (!user) {
    return res.status(401).json({
      message: 'Not authorized',
    });
  }
  return res.status(200).json({
    token: user.token,
    user: {
      subscription: user.subscription,
      email: user.email,
    },
  });
};

const logOut = async (req, res, next) => {
  const id = req.user?.id;
  const user = await User.getUserById(id);
  if (!user) {
    return res.status(401).json({
      message: 'Not authorized',
    });
  }
  await User.updateToken(user.id, null);
  return res.status(204).json({});
};

const updateAvatars = async (req, res, next) => {
  try {
    const id = req.user?.id;

    const { path: tempUpload, originalname } = req.file;

    const [extention] = originalname.split('.').reverse();
    const avatarName = `${id}.${extention}`;

    const resultUpload = path.join(tempDir, avatarName);

    const { file } = req;

    const img = await jimp.read(file.path);

    await img
      .autocrop()
      .cover(250, 250, jimp.HORIZONTAL_ALIGN_CENTER || VERTICAL_ALIGN_MIDDLE)
      .writeAsync(file.path);

    await fs.rename(tempUpload, resultUpload);

    const avatarURL = path.join('avatars', resultUpload);
    await User.updateUserAvatar(id, avatarURL);

    res.json({
      user: {
        avatarURL,
      },
      message: 'Avatar renewed',
    });
  } catch (error) {
    next();
  }
};

module.exports = {
  register,
  logIn,
  getCurrent,
  logOut,
  updateAvatars,
};
