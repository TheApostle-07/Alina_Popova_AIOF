/* eslint-disable no-console */
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  const email = process.argv[2] || "member.test@alinapopova.in";
  const phone = process.argv[3] || "+919000004999";

  await mongoose.connect(uri, { bufferCommands: false });

  const userSchema = new mongoose.Schema(
    {
      email: String,
      phone: String
    },
    { timestamps: true }
  );

  const subscriptionSchema = new mongoose.Schema(
    {
      userId: mongoose.Schema.Types.ObjectId,
      razorpayCustomerId: String,
      razorpaySubscriptionId: { type: String, unique: true },
      razorpayPlanId: String,
      status: String,
      currentStart: Date,
      currentEnd: Date,
      nextChargeAt: Date,
      lastPaymentId: String,
      lastEventAt: Date
    },
    { timestamps: true }
  );

  const User = mongoose.models.User || mongoose.model("User", userSchema, "users");
  const Subscription =
    mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema, "subscriptions");

  let user = await User.findOne({ $or: [{ email }, { phone }] });
  if (!user) {
    user = await User.create({ email, phone });
  } else {
    user.email = email;
    user.phone = phone;
    await user.save();
  }

  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let subscription = await Subscription.findOne({ userId: user._id }).sort({ updatedAt: -1 });
  if (!subscription) {
    subscription = await Subscription.create({
      userId: user._id,
      razorpayCustomerId: "cust_dummy_alina_member",
      razorpaySubscriptionId: `sub_dummy_${Date.now()}`,
      razorpayPlanId: process.env.RAZORPAY_PLAN_ID || "plan_dummy_499",
      status: "ACTIVE",
      currentStart: now,
      currentEnd: end,
      nextChargeAt: end,
      lastPaymentId: `pay_dummy_${Date.now()}`,
      lastEventAt: now
    });
  } else {
    subscription.status = "ACTIVE";
    subscription.currentStart = now;
    subscription.currentEnd = end;
    subscription.nextChargeAt = end;
    subscription.lastEventAt = now;
    if (!subscription.razorpayPlanId) {
      subscription.razorpayPlanId = process.env.RAZORPAY_PLAN_ID || "plan_dummy_499";
    }
    if (!subscription.razorpaySubscriptionId) {
      subscription.razorpaySubscriptionId = `sub_dummy_${Date.now()}`;
    }
    await subscription.save();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        phone,
        userId: String(user._id),
        subscriptionId: subscription.razorpaySubscriptionId,
        status: subscription.status,
        currentEnd: subscription.currentEnd?.toISOString() || null
      },
      null,
      2
    )
  );
}

main()
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // no-op
    }
  });
