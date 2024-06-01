import { catchAsyncError } from "../middlewares/CatchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import cloudinary from "cloudinary";
import getDataUri from "../utils/dataUri.js";
import { Category } from "../models/Category.js";

export const createPost = catchAsyncError(async (req, res, next) => {
  const { title, content, category } = req.body;
  const files = req.files;

  if (!title || !content || !category) {
    return next(new ErrorHandler("Vui lòng nhập đầy đủ thông tin!", 400));
  }

  let postData = {
    title,
    content,
    category,
    author: req.user._id,
    media: [],
  };

  if (files && files.length > 0) {
    for (let file of files) {
      const fileUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileUri.content, {
        resource_type: "auto",
      });
      postData.media.push({
        public_id: mycloud.public_id,
        url: mycloud.secure_url,
        type: file.mimetype.startsWith("image") ? "image" : "video",
      });
    }
  }

  const post = await Post.create(postData);

  res.status(201).json({
    success: true,
    post,
  });
});

export const getAllPosts = catchAsyncError(async (req, res, next) => {
  const posts = await Post.find()
    .populate("author", "name username avatar")
    .populate("category", "name");
  res.status(200).json({
    success: true,
    posts,
  });
});

export const getPostDetails = catchAsyncError(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate("author", "name username avatar")
    .populate("comments.user", "name username avatar")
    .populate("comments.replies.user", "name username avatar");

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  res.status(200).json({
    success: true,
    post,
  });
});

export const updatePost = catchAsyncError(async (req, res, next) => {
  const { title, content, category } = req.body;

  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  if (post.author.toString() !== req.user._id.toString()) {
    return next(
      new ErrorHandler("Bạn không có quyền cập nhật bài đăng này", 403)
    );
  }

  post.title = title || post.title;
  post.content = content || post.content;
  post.category = category || post.category;

  await post.save();

  res.status(200).json({
    success: true,
    post,
  });
});

export const deletePost = catchAsyncError(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  if (post.author.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Bạn không có quyền xóa bài đăng này", 403));
  }

  await cloudinary.v2.uploader.destroy(post.image.public_id);
  await post.remove();

  res.status(200).json({
    success: true,
    message: "Xóa bài đăng thành công",
  });
});

export const addComment = catchAsyncError(async (req, res, next) => {
  const { content, mentions } = req.body;
  const files = req.files;
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  const comment = {
    user: req.user._id,
    content,
    media: [],
    likes: [],
    replies: [], // Đảm bảo replies luôn là một mảng
  };

  if (files && files.length > 0) {
    for (let file of files) {
      const fileUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileUri.content, {
        resource_type: "auto",
      });
      comment.media.push({
        public_id: mycloud.public_id,
        url: mycloud.secure_url,
        type: file.mimetype.startsWith("image") ? "image" : "video",
      });
    }
  }

  post.comments.push(comment);
  await post.save();

  if (req.user._id.toString() !== post.author.toString()) {
    await Notification.create({
      user: post.author,
      from: req.user._id,
      message: `${req.user.username} đã bình luận về bài viết của bạn.`,
      postId: post._id,
    });

    if (mentions && mentions.length > 0) {
      for (const mention of mentions) {
        await Notification.create({
          user: mention,
          from: req.user._id,
          message: `${req.user.username} đã nhắc đến bạn trong một bình luận.`,
          postId: post._id,
        });
      }
    }
  }

  res.status(201).json({
    success: true,
    post,
  });
});

export const replyComment = catchAsyncError(async (req, res, next) => {
  const { content, commentId, replyId } = req.body;
  const files = req.files;
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  const comment = post.comments.id(commentId);
  if (!comment) {
    return next(new ErrorHandler("Bình luận không tồn tại", 404));
  }

  let targetReply = comment;
  if (replyId) {
    targetReply = comment.replies.id(replyId);
    if (!targetReply) {
      return next(new ErrorHandler("Trả lời không tồn tại", 404));
    }
  }

  const reply = {
    user: req.user._id,
    content,
    media: [],
    likes: [],
    replies: [], // Đảm bảo replies luôn là một mảng
  };

  if (files && files.length > 0) {
    for (let file of files) {
      const fileUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileUri.content, {
        resource_type: "auto",
      });
      reply.media.push({
        public_id: mycloud.public_id,
        url: mycloud.secure_url,
        type: file.mimetype.startsWith("image") ? "image" : "video",
      });
    }
  }

  targetReply.replies.push(reply);
  await post.save();

  if (req.user._id.toString() !== targetReply.user.toString()) {
    await Notification.create({
      user: targetReply.user,
      from: req.user._id,
      message: `${req.user.username} đã trả lời bình luận của bạn.`,
      postId: post._id,
      commentId: comment._id,
      replyId: targetReply._id,
    });
  }

  res.status(201).json({
    success: true,
    post,
  });
});

export const likeComment = catchAsyncError(async (req, res, next) => {
  const { postId, commentId, replyId } = req.params;
  const post = await Post.findById(postId);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  const comment = post.comments.id(commentId);
  if (!comment) {
    return next(new ErrorHandler("Bình luận không tồn tại", 404));
  }

  let target = comment;
  if (replyId) {
    target = comment.replies.id(replyId);
    if (!target) {
      return next(new ErrorHandler("Trả lời không tồn tại", 404));
    }
  }

  if (target.likes.includes(req.user._id)) {
    target.likes.pull(req.user._id);
  } else {
    target.likes.push(req.user._id);
  }

  await post.save();

  res.status(200).json({
    success: true,
    post,
  });
});

export const likePost = catchAsyncError(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  let isFirstLike = false;

  if (post.likes.includes(req.user._id)) {
    post.likes.pull(req.user._id);
  } else {
    post.likes.push(req.user._id);

    const existingNotification = await Notification.findOne({
      user: post.author,
      from: req.user._id,
      postId: post._id,
      message: `${req.user.username} đã thả tim bài viết của bạn.`,
    });

    if (!existingNotification) {
      isFirstLike = true;
    }
  }

  await post.save();

  if (isFirstLike) {
    await Notification.create({
      user: post.author,
      from: req.user._id,
      message: `${req.user.username} đã thả tim bài viết của bạn.`,
      postId: post._id,
    });
  }

  const updatedPost = await Post.findById(req.params.id)
    .populate("author", "name username avatar")
    .populate("comments.user", "name username avatar")
    .populate("category", "name");

  res.status(200).json({
    success: true,
    post: updatedPost,
  });
});

export const clearReadNotifications = catchAsyncError(
  async (req, res, next) => {
    const user = await User.findById(req.user._id);
    user.notifications = user.notifications.filter(
      (notification) => !notification.read
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: "Đã xóa tất cả thông báo đã đọc",
    });
  }
);

export const readNotification = catchAsyncError(async (req, res, next) => {
  const notification = await Notification.findById(req.params.notificationId);
  if (!notification) {
    return next(new ErrorHandler("Thông báo không tồn tại", 404));
  }

  notification.read = true;
  await notification.save();

  res.status(200).json({
    success: true,
    redirectUrl: notification.link,
  });
});

export const tagUser = catchAsyncError(async (req, res, next) => {
  const { username, postId } = req.body;

  const user = await User.findOne({ username });
  if (!user) {
    return next(new ErrorHandler("Người dùng không tồn tại", 404));
  }

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  const notification = await Notification.create({
    user: user._id,
    from: req.user._id,
    message: `${req.user.username} đã tag bạn trong một bài viết.`,
    postId: post._id,
  });

  res.status(200).json({
    success: true,
    notification,
  });
});

export const createCategory = catchAsyncError(async (req, res, next) => {
  const { name } = req.body;

  if (!name) {
    return next(new ErrorHandler("Vui lòng nhập tên danh mục!", 400));
  }

  const category = await Category.create({ name });

  res.status(201).json({
    success: true,
    category,
  });
});

export const getAllCategories = catchAsyncError(async (req, res, next) => {
  const categories = await Category.find();

  res.status(200).json({
    success: true,
    categories,
  });
});

export const updateCategory = catchAsyncError(async (req, res, next) => {
  const { name } = req.body;
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorHandler("Danh mục không tồn tại", 404));
  }

  category.name = name || category.name;
  await category.save();

  res.status(200).json({
    success: true,
    category,
  });
});

export const deleteCategory = catchAsyncError(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorHandler("Danh mục không tồn tại", 404));
  }

  await category.remove();

  res.status(200).json({
    success: true,
    message: "Xóa danh mục thành công",
  });
});
