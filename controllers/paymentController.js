import { catchAsyncError } from "../middlewares/CatchAsyncError.js";
import { User } from "../models/User.js";
import { payOS } from "../index.js";
import Payment from "../models/Payment.js";
import { Transaction } from "../models/Transaction.js";

export const createPaymentLink = catchAsyncError(async (req, res, next) => {
  const { coinAmount } = req.body;
  const totalPayments = await Payment.countDocuments();
  const code = totalPayments + 14;
  const body = {
    orderCode: code,
    amount: coinAmount * 10,
    description: "Nạp số coin",
    items: [
      {
        name: `Nạp ${coinAmount} coin DVT Trade Web`,
        quantity: 1,
        price: coinAmount * 10,
      },
    ],
    cancelUrl: "http://localhost:5173/payment-fail",
    returnUrl: `http://localhost:5173/payment-success/${coinAmount}`,
  };

  const paymentLinkRes = await payOS.createPaymentLink(body);
  const payment = new Payment({
    userId: req.user.id,
    orderCode: code,
    amount: coinAmount * 10,
    status: "pending",
  });
  await payment.save();
  res.status(200).json({
    success: true,
    link: paymentLinkRes,
  });
});

export const webhookConfirm = catchAsyncError(async (req, res, next) => {
  try {
    const { status } = req.body || "cancel";
    const latestPayment = await Payment.findOne().sort({ createdAt: -1 });
    await updateUserBalance(latestPayment.orderCode, status);

    res.status(200).send("Nạp tiền thành công");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Có lỗi xảy ra", error);
  }
});

export const updateUserBalance = async (orderCode, status) => {
  const payment = await Payment.findOne({ orderCode });

  if (!payment) {
    throw new Error("Không tìm thấy hoá đơn");
  }

  const user = await User.findById(payment.userId);
  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }

  if (payment.status !== "success" && status === "success") {
    user.coin += payment.amount / 10;
  }

  payment.status = status;
  await payment.save();
  await user.save();
};

export const getUserTransactions = catchAsyncError(async (req, res, next) => {
  try {
    const { filter } = req.query;
    const now = new Date();
    let startDate;

    switch (filter) {
      case "day":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(0); // Lấy tất cả các giao dịch
    }

    const transactions = await Payment.find({
      userId: req.user._id,
      status: "success",
      createdAt: { $gte: startDate }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server lỗi",
    });
  }
});

export const getUserCardTransactions = catchAsyncError(async (req, res, next) => {
  try {
    const { filter } = req.query;
    const now = new Date();
    let startDate;

    switch (filter) {
      case "day":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(0); // Lấy tất cả các giao dịch
    }

    const transactions = await Transaction.find({
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
      createdAt: { $gte: startDate }
    })
    .sort({ createdAt: -1 })
    .populate('buyer', 'name addressWallet')
    .populate('seller', 'name addressWallet')
    .populate('card', 'name image');

    res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error("Không thể lấy được thông tin hoá đơn:", error);
    res.status(500).json({
      success: false,
      message: "Server lỗi",
    });
  }
});

export const getCardTransactionsByWalletAddress = catchAsyncError(async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const user = await User.findOne({ addressWallet: walletAddress });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    const transactions = await Transaction.find({
      $or: [{ buyer: user._id }, { seller: user._id }]
    })
    .sort({ createdAt: -1 })
    .populate('buyer', 'name addressWallet')
    .populate('seller', 'name addressWallet')
    .populate('card', 'name image');

    res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error("Không thể tìm thấy thông tin giao dịch qua địa chỉ ví này:", error);
    res.status(500).json({
      success: false,
      message: "Server lỗi",
    });
  }
});
