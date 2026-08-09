// services/PaymentService.js
const Payment = require('../models/paymentModel'); // Exported from your PaymentSchema
const Order = require('../models/orderModel');
const Shop = require('./shopServies')
const LineService = require('../services/lineService')
class PaymentService {
  /**
   * Process a payment for a shop and distribute it across pending orders (Oldest First)
   */
  async updateOrderPayment(shopId) {
    const shop = (await Shop.findShopById(shopId))[0];
    if (!shop) throw new Error('Shop not found');

    // 1. Retrieve ALL payments for this shop with unallocated amounts (FIFO order)
    const unallocatedPayments = await Payment.find({
      shopId,
      unallocatedAmount: { $gt: 0 }
    }).sort({ paymentDate: 1, createdAt: 1 });

    // 2. Retrieve ALL pending orders for this shop (FIFO order)
    const pendingOrders = await Order.find({
      shopId,
      pendingAmount: { $gt: 0 }
    }).sort({ orderDate: 1, createdAt: 1 });

    let orderIndex = 0;

    // 3. Iterate through each payment document with unallocated money
    for (const payment of unallocatedPayments) {
      if (orderIndex >= pendingOrders.length) break; // All orders fully settled

      while (payment.unallocatedAmount > 0 && orderIndex < pendingOrders.length) {
        const order = pendingOrders[orderIndex];

        // Determine allocation amount for this specific order
        const allocation = Math.min(payment.unallocatedAmount, order.pendingAmount);

        // Update Payment document's unallocated amount and allocations array
        payment.unallocatedAmount -= allocation;
        payment.allocations.push({
          orderId: order._id,
          allocatedAmount: allocation
        });

        // Update Order document's financials
        order.paidAmount = (order.paidAmount || 0) + allocation;
        order.pendingAmount = Math.max(0, order.totalPayableAmount - order.paidAmount);

        if (order.pendingAmount === 0) {
          order.paymentStatus = 'PAID';
          orderIndex++; // Move to next order once current is fully paid
        } else {
          order.paymentStatus = 'PARTIAL';
        }
      }

      // Save updated payment record
      payment.unallocatedAmount = Number(payment.unallocatedAmount.toFixed(2))
      payment.unallocatedAmount = Number(payment.unallocatedAmount.toFixed(2))
      await payment.save();
    }

    // 4. Save all updated order documents
    for (const order of pendingOrders) {
      if (order.isModified()) {
        await order.save();
      }
    }

    // 5. Synchronize Shop balances
    const remainingUnallocatedPayments = await Payment.find({ shopId, unallocatedAmount: { $gt: 0 } });
    shop.creditBalance = remainingUnallocatedPayments.reduce((sum, p) => sum + p.unallocatedAmount, 0);

    const remainingPendingOrders = await Order.find({ shopId, pendingAmount: { $gt: 0 } });
    shop.totalOutstandingBalance = remainingPendingOrders.reduce((sum, o) => sum + o.pendingAmount, 0);

    console.log(shop.creditBalance)
    console.log(shop.totalOutstandingBalance)
    await Shop.updateShop(shopId,shop);
    return {
      shopBalances: {
        creditBalance: shop.creditBalance,
        totalOutstandingBalance: shop.totalOutstandingBalance
      },
      remainingUnallocatedPaymentsCount: remainingUnallocatedPayments.length,
      remainingPendingOrdersCount: remainingPendingOrders.length
    };
  }

  /**
   * Processes a newly received payment and triggers FIFO settlement.
   */
  async processShopPayment(paymentData) {
    const {lineId, shopId, amountPaid, paymentMode, transactionRef, notes, paymentDate } = paymentData;

    if (!amountPaid || amountPaid <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    // 1. Save new Payment record with full amount initially unallocated
    const payment = await Payment.create({
      lineId,
      shopId,
      amountPaid,
      unallocatedAmount: amountPaid,
      allocations: [],
      paymentMode,
      transactionRef,
      notes,
      paymentDate: paymentDate || new Date()
    });

    // 2. Run FIFO settlement for this shop
    const settlementSummary = await this.updateOrderPayment(shopId);

    LineService.addPayment(payment.lineId,payment.shopId,payment._id,payment.amountPaid)

    return {
      success: true,
      paymentId: payment._id,
      ...settlementSummary
    };
  }

  // Fetch all payment history for a specific shop
  async getPaymentsByShop(shopId) {
    return await Payment.find({ shopId }).sort({ paymentDate: -1 });
  }

  // Fetch all payment history across system
  async getAllPayments() {
    return await Payment.find().populate('shopId', 'name ownerName').sort({ paymentDate: -1 });
  }
}

module.exports = new PaymentService();