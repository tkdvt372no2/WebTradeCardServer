import { catchAsyncError } from "../middlewares/CatchAsyncError.js";
import { Card } from "../models/Card.js";
import getDataUri from "../utils/dataUri.js";
import ErrorHandler from "../utils/errorHandler.js";
import cloudinary from "cloudinary";
import { Stats } from "../models/Stats.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";

export const getAllCards = async (req, res, next) => {
  try {
    const keyword = req.query.keyword || "";
    const type = req.query.type || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    const totalCards = await Card.countDocuments({
      name: { $regex: keyword, $options: "i" },
      type: { $regex: type, $options: "i" },
    });

    const cards = await Card.find({
      name: { $regex: keyword, $options: "i" },
      type: { $regex: type, $options: "i" },
    })
      .skip(skip)
      .limit(limit);
    const totalP = Math.ceil(totalCards / limit);
    res.status(200).json({
      success: true,
      cards,
      totalCards,
      page,
      totalPages: totalP,
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Lỗi xảy ra khi lấy thẻ tướng" });
  }
};

export const getCardById = async (req, res, next) => {
  try {
    const cardId = req.params.id;
    const card = await Card.findById(cardId);

    if (!card) {
      return res.status(404).json({ success: false, error: "Card not found" });
    }

    res.status(200).json({ success: true, card });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Lỗi xảy ra khi lấy thông tin thẻ" });
  }
};

export const createCard = catchAsyncError(async (req, res, next) => {
  const { name, total, description, price } = req.body;
  if (!name || !total || !price || !description)
    return next(new ErrorHandler("Vui lòng nhập đầy đủ thông tin", 400));
  const file = req.file;
  const fileUri = getDataUri(file);
  const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);

  await Card.create({
    name,
    total,
    price,
    description,
    image: {
      public_id: mycloud.public_id,
      url: mycloud.secure_url,
    },
  });

  res.status(201).json({
    success: true,
    message: "Tạo thẻ thành công, bạn có thể thêm các bài giảng!",
  });
});

export const buyCard = catchAsyncError(async (req, res, next) => {
  const id = req.user._id;
  const cardId = req.params.id;
  const { transactionType } = req.body;

  const user = await User.findById(id).select("+coin");
  const card = await Card.findById(cardId);

  if (!user || !card) {
    return res.status(404).json({
      success: false,
      message: "Người dùng hoặc thẻ không tồn tại",
    });
  }

  if (user.coin < card.price) {
    return res.status(400).json({
      success: false,
      message: "Bạn không đủ coin để mua thẻ này",
    });
  }

  let seller = null;
  let price = card.price;

  if (transactionType === "resale") {
    const listingIndex = card.listings.findIndex(
      (listing) => listing.status === "Chưa bán"
    );

    if (listingIndex > -1) {
      const listing = card.listings[listingIndex];
      seller = await User.findOne({ addressWallet: listing.seller });
      if (seller) {
        price = listing.price;
        card.listings[listingIndex].status = "Đã bán";

        const sellerCardIndex = seller.myCard.findIndex(
          (item) => item.card.toString() === card._id.toString()
        );

        if (sellerCardIndex > -1) {
          seller.myCard[sellerCardIndex].total -= 1;
          if (seller.myCard[sellerCardIndex].total === 0) {
            seller.myCard.splice(sellerCardIndex, 1);
          }
        }

        seller.coin += price;
        await seller.save();
      }
    }
  } else {
    card.total -= 1;
  }

  const existingCardIndex = user.myCard.findIndex(
    (item) => item.card.toString() === card._id.toString()
  );

  if (existingCardIndex > -1) {
    user.myCard[existingCardIndex].total += 1;
  } else {
    user.myCard.push({
      card: card._id,
      image: card.image.url,
      name: card.name,
      total: 1,
    });
  }

  user.coin -= price;

  await Transaction.create({
    buyer: user._id,
    seller: seller ? seller._id : null,
    card: card._id,
    price: price,
    transactionType: transactionType,
  });

  await user.save();
  await card.save();

  res.status(200).json({
    success: true,
    message: "Mua thẻ thành công",
  });
});

export const sellCard = catchAsyncError(async (req, res, next) => {
  const { cardId, price } = req.body;
  const userId = req.user._id;

  const user = await User.findById(userId);
  const card = await Card.findById(cardId);

  if (!user || !card) {
    return res.status(404).json({
      success: false,
      message: "Người dùng hoặc thẻ không tồn tại",
    });
  }

  const userCardIndex = user.myCard.findIndex(
    (item) => item.card.toString() === card._id.toString()
  );

  if (userCardIndex === -1) {
    return res.status(400).json({
      success: false,
      message: "Bạn không sở hữu thẻ này",
    });
  }

  if (user.myCard[userCardIndex].total < 1) {
    return res.status(400).json({
      success: false,
      message: "Bạn không có đủ số lượng thẻ để bán",
    });
  }

  user.myCard[userCardIndex].total -= 1;

  if (user.myCard[userCardIndex].total === 0) {
    user.myCard.splice(userCardIndex, 1);
  }

  card.listings.push({
    seller: user.addressWallet,
    price,
    status: "Chưa bán",
  });

  await user.save();
  await card.save();

  res.status(200).json({
    success: true,
    message: "Đăng bán thẻ thành công",
  });
});

export const getRandomCards = async () => {
  const cards = await Card.aggregate([{ $sample: { size: 5 } }]);
  return cards;
};

export const updateCardTotals = async (cards) => {
  for (const card of cards) {
    await Card.findByIdAndUpdate(
      card._id,
      { $inc: { total: -1 } },
      { new: true, runValidators: true }
    );
  }
};

export const sendCard = catchAsyncError(async (req, res, next) => {
  const { cardId, diaChiNguoiNhan, amount } = req.body;
  const nguoiGuiId = req.user._id;

  const nguoiGui = await User.findById(nguoiGuiId);
  const card = await Card.findById(cardId);
  const nguoiNhan = await User.findOne({ addressWallet: diaChiNguoiNhan });

  if (!nguoiGui || !card || !nguoiNhan) {
    return res.status(404).json({
      success: false,
      message: "Người dùng, thẻ hoặc người nhận không tồn tại",
    });
  }

  const nguoiGuiCardIndex = nguoiGui.myCard.findIndex(
    (item) => item.card.toString() === card._id.toString()
  );

  if (
    nguoiGuiCardIndex === -1 ||
    nguoiGui.myCard[nguoiGuiCardIndex].total < amount
  ) {
    return res.status(400).json({
      success: false,
      message: "Bạn không có đủ số lượng thẻ để gửi",
    });
  }

  nguoiGui.myCard[nguoiGuiCardIndex].total -= amount;
  if (nguoiGui.myCard[nguoiGuiCardIndex].total === 0) {
    nguoiGui.myCard.splice(nguoiGuiCardIndex, 1);
  }

  const nguoiNhanCardIndex = nguoiNhan.myCard.findIndex(
    (item) => item.card.toString() === card._id.toString()
  );

  if (nguoiNhanCardIndex > -1) {
    nguoiNhan.myCard[nguoiNhanCardIndex].total += amount;
  } else {
    nguoiNhan.myCard.push({
      card: card._id,
      image: card.image.url,
      name: card.name,
      total: amount,
    });
  }

  await nguoiGui.save();
  await nguoiNhan.save();

  await Transaction.create({
    buyer: nguoiNhan._id,
    seller: nguoiGui._id,
    card: card._id,
    price: 0,
    transactionType: "gift",
  });

  res.status(200).json({
    success: true,
    message: "Gửi thẻ thành công",
  });
});

export const getUserListings = catchAsyncError(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorHandler("Người dùng không tồn tại", 404));
  }

  const cards = await Card.find({ "listings.seller": user.addressWallet });

  const listings = cards
    .map((card) =>
      card.listings.filter((listing) => listing.seller === user.addressWallet)
    )
    .flat();

  res.status(200).json({
    success: true,
    listings,
  });
});

export const cancelSell = catchAsyncError(async (req, res, next) => {
  const { cardId, listingId } = req.body;
  const userId = req.user._id;

  const user = await User.findById(userId);
  const card = await Card.findById(cardId);

  if (!user || !card) {
    return res.status(404).json({
      success: false,
      message: "Người dùng hoặc thẻ không tồn tại",
    });
  }

  const listingIndex = card.listings.findIndex(
    (listing) =>
      listing._id.toString() === listingId &&
      listing.seller === user.addressWallet
  );

  if (listingIndex === -1) {
    return res.status(400).json({
      success: false,
      message: "Đơn hàng không tồn tại hoặc không thuộc về bạn",
    });
  }

  card.listings.splice(listingIndex, 1);

  const userCardIndex = user.myCard.findIndex(
    (item) => item.card.toString() === card._id.toString()
  );

  if (userCardIndex > -1) {
    user.myCard[userCardIndex].total += 1;
  } else {
    user.myCard.push({
      card: card._id,
      image: card.image.url,
      name: card.name,
      total: 1,
    });
  }

  await user.save();
  await card.save();

  res.status(200).json({
    success: true,
    message: "Hủy rao bán thành công và thẻ đã được hoàn lại",
  });
});
