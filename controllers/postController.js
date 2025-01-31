import { catchAsyncError } from "../middlewares/CatchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { Comment, Post, Reaction, Reply } from "../models/Post.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import cloudinary from "cloudinary";
import getDataUri from "../utils/dataUri.js";
import { Category } from "../models/Category.js";
import { createNotification } from "../utils/socket.js";

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
  const posts = await Post.find({ deleted: false })
    .populate("author", "name username avatar addressWallet")
    .populate("category", "name")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            { path: "likes", select: "name username avatar" },
            {
              path: "reactions",
              populate: [
                { path: "user", select: "name username avatar" },
                { path: "likes", select: "name username avatar" },
              ],
            },
          ],
        },
      ],
    });

  res.status(200).json({
    success: true,
    posts,
  });
});

export const getPostDetails = catchAsyncError(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate("author", "name username avatar addressWallet")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            { path: "likes", select: "name username avatar" },
            {
              path: "reactions",
              populate: [
                { path: "user", select: "name username avatar" },
                { path: "likes", select: "name username avatar" },
              ],
            },
          ],
        },
      ],
    });

  if (!post || post.deleted) {
    return next(new ErrorHandler("Bài đăng không còn tồn tại", 404));
  }

  res.status(200).json({
    success: true,
    post,
  });
});

export const updatePost = catchAsyncError(async (req, res, next) => {
  const { title, content, category, mediaToDelete } = req.body;
  const files = req.files;

  const post = await Post.findById(req.params.id)
    .populate("author", "name username avatar")
    .populate("category", "name")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            { path: "likes", select: "name username avatar" },
            {
              path: "reactions",
              populate: [
                { path: "user", select: "name username avatar" },
                { path: "likes", select: "name username avatar" },
              ],
            },
          ],
        },
      ],
    });

  if (!post || post.deleted) {
    return next(new ErrorHandler("Bài đăng không tồn tại hoặc đã bị xóa", 404));
  }

  if (post.author._id.toString() !== req.user._id.toString()) {
    return next(
      new ErrorHandler("Bạn không có quyền cập nhật bài đăng này", 403)
    );
  }

  post.title = title || post.title;
  post.content = content || post.content;
  post.category = category || post.category;

  if (mediaToDelete && mediaToDelete.length > 0) {
    const mediaPublicIdsToDelete = post.media
      .filter((media) => mediaToDelete.includes(media.public_id))
      .map((media) => ({ public_id: media.public_id, type: media.type }));

    post.media = post.media.filter(
      (media) => !mediaToDelete.includes(media.public_id)
    );

    for (const { public_id, type } of mediaPublicIdsToDelete) {
      let resourceType = "image";
      if (type === "video") {
        resourceType = "video";
      }

      try {
        const result = await cloudinary.v2.uploader.destroy(public_id, {
          resource_type: resourceType,
        });
      } catch (error) {
        console.error("Lỗi khi xóa:", error);
      }
    }
  }

  if (files && files.length > 0) {
    for (let file of files) {
      const fileUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileUri.content, {
        resource_type: "auto",
      });
      post.media.push({
        public_id: mycloud.public_id,
        url: mycloud.secure_url,
        type: file.mimetype.startsWith("image") ? "image" : "video",
      });
    }
  }

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

  post.deleted = true;
  await post.save();

  res.status(200).json({
    success: true,
    message: "Xóa bài đăng thành công",
  });
});

export const addComment = catchAsyncError(async (req, res, next) => {
  const { content } = req.body;
  const files = req.files;
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  if (!content || !req.user._id) {
    return next(
      new ErrorHandler("Nội dung bình luận và người dùng là bắt buộc", 400)
    );
  }

  const comment = new Comment({
    user: req.user._id,
    content,
    media: [],
    likes: [],
    replies: [],
  });

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

  await comment.save();

  post.comments.push(comment);
  await post.save();

  if (String(post.author) !== String(req.user._id)) {
    await createNotification(
      post.author,
      req.user._id,
      `${req.user.username} đã bình luận trên bài viết của bạn.`,
      "comment",
      post._id
    );
  }

  const mentionedUsers = content.match(/@\w+/g);
  if (mentionedUsers) {
    for (let username of mentionedUsers) {
      const user = await User.findOne({ username: username.slice(1) });
      if (user && String(user._id) !== String(req.user._id)) {
        await createNotification(
          user._id,
          req.user._id,
          `${req.user.username} đã tag bạn trong một bình luận.`,
          "comment",
          post._id
        );
      }
    }
  }

  const updatedPost = await Post.findById(req.params.id)
    .populate("author", "name username avatar")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            { path: "likes", select: "name username avatar" },
            {
              path: "reactions",
              populate: [
                { path: "user", select: "name username avatar" },
                { path: "likes", select: "name username avatar" },
              ],
            },
          ],
        },
      ],
    });

  res.status(201).json({
    success: true,
    post: updatedPost,
  });
});

export const replyComment = catchAsyncError(async (req, res, next) => {
  const { content, commentId } = req.body;
  const files = req.files;
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return next(new ErrorHandler("Bình luận không tồn tại", 404));
  }

  if (!content || !req.user._id) {
    return next(
      new ErrorHandler("Nội dung trả lời và người dùng là bắt buộc", 400)
    );
  }

  const reply = new Reply({
    user: req.user._id,
    content,
    media: [],
    likes: [],
    reactions: [],
  });

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

  await reply.save();
  comment.replies.push(reply._id);
  await comment.save();
  await post.save();

  if (String(comment.user) !== String(req.user._id)) {
    await createNotification(
      comment.user,
      req.user._id,
      `${req.user.username} đã trả lời bình luận của bạn.`,
      "comment",
      post._id
    );
  }

  const mentionedUsers = content.match(/@\w+/g);
  if (mentionedUsers) {
    for (let username of mentionedUsers) {
      const user = await User.findOne({ username: username.slice(1) });
      if (user && String(user._id) !== String(req.user._id)) {
        await createNotification(
          user._id,
          req.user._id,
          `${req.user.username} đã tag bạn trong một trả lời.`,
          "comment",
          reply._id
        );
      }
    }
  }

  const updatedPost = await Post.findById(req.params.id)
    .populate("author", "name username avatar")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            { path: "likes", select: "name username avatar" },
            {
              path: "reactions",
              populate: [
                { path: "user", select: "name username avatar" },
                { path: "likes", select: "name username avatar" },
              ],
            },
          ],
        },
      ],
    });

  res.status(201).json({
    success: true,
    post: updatedPost,
  });
});

export const likeComment = catchAsyncError(async (req, res, next) => {
  const { postId, commentId } = req.params;
  const post = await Post.findById(postId);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return next(new ErrorHandler("Bình luận không tồn tại", 404));
  }

  if (comment.likes.includes(req.user._id)) {
    comment.likes.pull(req.user._id);
  } else {
    comment.likes.push(req.user._id);

    if (String(comment.user) !== String(req.user._id)) {
      const existingNotification = await Notification.findOne({
        user: comment.user,
        from: req.user._id,
        message: `${req.user.username} đã thả tim bình luận của bạn.`,
        type: "like",
        targetId: post._id,
        commentId: comment._id,
      });

      if (!existingNotification) {
        await createNotification(
          comment.user,
          req.user._id,
          `${req.user.username} đã thả tim bình luận của bạn.`,
          "like",
          post._id,
          comment._id
        );
      }
    }
  }

  await comment.save();
  await post.save();

  const updatedPost = await Post.findById(postId)
    .populate("author", "name username avatar")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            { path: "likes", select: "name username avatar" },
            {
              path: "reactions",
              populate: [
                { path: "user", select: "name username avatar" },
                { path: "likes", select: "name username avatar" },
              ],
            },
          ],
        },
      ],
    });

  res.status(200).json({
    success: true,
    post: updatedPost,
  });
});

export const replyReply = catchAsyncError(async (req, res, next) => {
  const { content, replyId } = req.body;
  const files = req.files;
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }
  const reply = await Reply.findById(replyId);
  if (!reply) {
    return next(new ErrorHandler("Trả lời không tồn tại", 404));
  }

  if (!content || !req.user._id) {
    return next(
      new ErrorHandler("Nội dung trả lời và người dùng là bắt buộc", 400)
    );
  }

  const newReaction = new Reaction({
    user: req.user._id,
    content,
    media: [],
    likes: [],
  });

  if (files && files.length > 0) {
    for (let file of files) {
      const fileUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileUri.content, {
        resource_type: "auto",
      });
      newReaction.media.push({
        public_id: mycloud.public_id,
        url: mycloud.secure_url,
        type: file.mimetype.startsWith("image") ? "image" : "video",
      });
    }
  }

  await newReaction.save();
  reply.reactions.push(newReaction._id);
  await reply.save();

  if (String(reply.user) !== String(req.user._id)) {
    await createNotification(
      reply.user,
      req.user._id,
      `${req.user.username} đã trả lời phản hồi của bạn.`,
      "comment",
      post.id
    );
  }

  const mentionedUsers = content.match(/@\w+/g);
  if (mentionedUsers) {
    for (let username of mentionedUsers) {
      const user = await User.findOne({ username: username.slice(1) });
      if (user && String(user._id) !== String(req.user._id)) {
        await createNotification(
          user._id,
          req.user._id,
          `${req.user.username} đã tag bạn trong một trả lời.`,
          "comment",
          reply._id
        );
      }
    }
  }

  const updatedPost = await Post.findById(req.params.id)
    .populate("author", "name username avatar")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            { path: "likes", select: "name username avatar" },
            {
              path: "reactions",
              populate: [
                { path: "user", select: "name username avatar" },
                { path: "likes", select: "name username avatar" },
              ],
            },
          ],
        },
      ],
    });

  res.status(201).json({
    success: true,
    post: updatedPost,
  });
});

export const likeReply = catchAsyncError(async (req, res, next) => {
  const { postId, replyId } = req.params;
  const post = await Post.findById(postId);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  const reply = await Reply.findById(replyId);
  if (!reply) {
    return next(new ErrorHandler("Trả lời không tồn tại", 404));
  }

  let isFirstLike = false;

  if (reply.likes.includes(req.user._id)) {
    reply.likes.pull(req.user._id);
  } else {
    reply.likes.push(req.user._id);

    const existingNotification = await Notification.findOne({
      user: reply.user,
      from: req.user._id,
      message: `${req.user.username} đã thả tim phản hồi của bạn.`,
      type: "like",
      targetId: post._id,
      commentId: reply._id,
    });
    if (!existingNotification) {
      isFirstLike = true;
    }
  }

  await reply.save();
  await post.save();

  if (isFirstLike) {
    await createNotification(
      reply.user,
      req.user._id,
      `${req.user.username} đã thả tim phản hồi của bạn.`,
      "like",
      post._id,
      reply._id
    );
  }

  const updatedPost = await Post.findById(postId)
    .populate("author", "name username avatar")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            {
              path: "reactions",
              populate: { path: "user", select: "name username avatar" },
            },
          ],
        },
      ],
    });

  res.status(200).json({
    success: true,
    post: updatedPost,
  });
});

export const likePost = catchAsyncError(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ErrorHandler("Bài đăng không tồn tại", 404));
  }

  if (post.likes.includes(req.user._id)) {
    post.likes.pull(req.user._id);
  } else {
    post.likes.push(req.user._id);

    if (String(post.author) !== String(req.user._id)) {
      const existingNotification = await Notification.findOne({
        user: post.author,
        from: req.user._id,
        targetId: post._id,
        type: "post",
        message: `${req.user.username} đã thả tim bài viết của bạn.`,
      });

      if (!existingNotification) {
        await createNotification(
          post.author,
          req.user._id,
          `${req.user.username} đã thả tim bài viết của bạn.`,
          "post",
          post._id
        );
      }
    }
  }

  await post.save();

  const updatedPost = await Post.findById(req.params.id)
    .populate("author", "name username avatar")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        {
          path: "replies",
          populate: [
            { path: "user", select: "name username avatar" },
            { path: "likes", select: "name username avatar" },
            {
              path: "reactions",
              populate: [
                { path: "user", select: "name username avatar" },
                { path: "likes", select: "name username avatar" },
              ],
            },
          ],
        },
      ],
    });

  res.status(200).json({
    success: true,
    post: updatedPost,
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
    targetId: post._id,
    type: "post",
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

export const clearReadNotifications = catchAsyncError(
  async (req, res, next) => {
    await Notification.updateMany(
      { user: req.user._id, read: true },
      { deleted: true }
    );

    res.status(200).json({
      success: true,
      message: "Đã đánh dấu tất cả thông báo đã đọc là đã xóa",
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

  let redirectUrl = null;
  switch (notification.type) {
    case "post":
      redirectUrl = `/forum/post/${notification.targetId}`;
      break;
    case "comment":
      redirectUrl = `/forum/post/${notification.targetId}`;
      break;
    case "like":
      redirectUrl = `/forum/post/${notification.targetId}`;
      break;
    case "friendRequest":
      redirectUrl = `/profile/friends`;
      break;
    case "friendRequestAccepted":
      redirectUrl = `/profile/friends`;
      break;
    default:
      break;
  }
  res.status(200).json({
    success: true,
    redirectUrl,
  });
});

export const getAllNotifications = catchAsyncError(async (req, res, next) => {
  const notifications = await Notification.find({
    user: req.user._id,
    deleted: false,
  })
    .sort({
      createdAt: -1,
    })
    .populate("from", "name username avatar");

  res.status(200).json({
    success: true,
    notifications,
  });
});

export const searchUsersByUsername = catchAsyncError(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return res
      .status(400)
      .json({ success: false, message: "Không tìm thấy hashtag nào" });
  }

  const users = await User.find({
    username: { $regex: query, $options: "i" },
  }).select("username");

  const formattedUsers = users.map((user) => ({
    ...user._doc,
    username: `@${user.username}`,
  }));

  res.status(200).json({ success: true, users: formattedUsers });
});
