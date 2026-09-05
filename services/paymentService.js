const Payment = require('../models/paymentModel');
const Order = require('../models/orderModel');
const Shop = require('../models/shopModel');
const LineService = require('./lineService');

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

class PaymentService {
  /**
   * A payment recorded from a line must settle that line's current visit only.
   * Client-side max attributes are helpful, but this server-side check is the
   * authoritative guard against a stale screen or a crafted request.
   */
  async assertLinePaymentIsWithinBalance(lineId, shopId, amountPaid, existingPaymentAmount = 0) {
    const amount = roundMoney(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error('Payment amount must be greater than 0'), { status: 400 });
    }

    const visit = await LineService.getLineVisitBalance(lineId, shopId);
    const available = roundMoney(visit.pending + Number(existingPaymentAmount || 0));
    if (amount > available + 0.005) {
      throw Object.assign(
        new Error(`Cannot collect more than this line's outstanding amount (₹${available.toFixed(2)})`),
        { status: 400 }
      );
    }
    return visit;
  }

  /**
   * Rebuild allocations deterministically. This is deliberately used after a
   * delivery is created, edited, or deleted so balances never drift from the
   * orders and payments stored in MongoDB.
   */
  async rebuildShopBalances(shopId) {
    const [payments, orders] = await Promise.all([
      Payment.find({ shopId }).sort({ paymentDate: 1, createdAt: 1 }),
      Order.find({ shopId, deliveryStatus: { $ne: 'CANCELLED' } })
        .sort({ orderDate: 1, createdAt: 1 })
    ]);

    for (const order of orders) {
      order.paidAmount = 0;
      order.pendingAmount = roundMoney(order.totalPayableAmount || 0);
      order.paymentStatus = order.pendingAmount === 0 ? 'PAID' : 'NOT_PAID';
    }

    let orderIndex = 0;
    for (const payment of payments) {
      let remaining = roundMoney(payment.amountPaid);
      payment.allocations = [];

      while (remaining > 0 && orderIndex < orders.length) {
        const order = orders[orderIndex];
        const allocation = Math.min(remaining, order.pendingAmount);

        if (allocation > 0) {
          payment.allocations.push({ orderId: order._id, allocatedAmount: allocation });
          order.paidAmount = roundMoney(order.paidAmount + allocation);
          order.pendingAmount = roundMoney(order.totalPayableAmount - order.paidAmount);
          order.paymentStatus = order.pendingAmount === 0 ? 'PAID' : 'PARTIAL';
          remaining = roundMoney(remaining - allocation);
        }

        if (order.pendingAmount <= 0) orderIndex += 1;
      }

      payment.unallocatedAmount = remaining;
      await payment.save();
    }

    await Promise.all(orders.map((order) => order.save()));

    const outstanding = orders.reduce((sum, order) => sum + order.pendingAmount, 0);
    const credit = payments.reduce((sum, payment) => sum + payment.unallocatedAmount, 0);
    const shop = await Shop.findByIdAndUpdate(
      shopId,
      {
        totalOutstandingBalance: roundMoney(outstanding),
        creditBalance: roundMoney(credit)
      },
      { new: true, runValidators: true }
    );

    if (!shop) throw new Error('Shop not found');

    return {
      shopBalances: {
        creditBalance: shop.creditBalance,
        totalOutstandingBalance: shop.totalOutstandingBalance
      },
      remainingUnallocatedPaymentsCount: payments.filter((payment) => payment.unallocatedAmount > 0).length,
      remainingPendingOrdersCount: orders.filter((order) => order.pendingAmount > 0).length
    };
  }

  // Kept as the existing service's public method for compatibility.
  async updateOrderPayment(shopId) {
    return this.rebuildShopBalances(shopId);
  }

  async processShopPayment(paymentData) {
    const {
      lineId,
      shopId,
      sourceOrderId,
      amountPaid,
      paymentMode = 'CASH',
      transactionRef,
      notes,
      paymentDate
    } = paymentData;

    await this.assertLinePaymentIsWithinBalance(lineId, shopId, amountPaid);

    const payment = await Payment.create({
      lineId,
      shopId,
      sourceOrderId,
      amountPaid: roundMoney(amountPaid),
      unallocatedAmount: roundMoney(amountPaid),
      allocations: [],
      paymentMode,
      transactionRef,
      notes,
      paymentDate: paymentDate || new Date()
    });

    const settlementSummary = await this.rebuildShopBalances(shopId);
    await LineService.addPayment(lineId, shopId, payment._id, payment.amountPaid);

    return { success: true, paymentId: payment._id, ...settlementSummary };
  }

  async getPaymentsByShop(shopId) {
    return Payment.find({ shopId }).sort({ paymentDate: -1, createdAt: -1 });
  }

  async getAllPayments() {
    return Payment.find().populate('shopId', 'name ownerName').sort({ paymentDate: -1 });
  }
}

module.exports = new PaymentService();
