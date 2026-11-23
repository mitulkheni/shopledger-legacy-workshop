var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function mixedRateOrder() {
  return {
    id: 42,
    coupon: 'SAVE10',
    total: 963.90,
    items: [
      {
        id: 1,
        name: 'Rice',
        sku: 'RICE-001',
        hsn: '1006',
        price: 640,
        qty: 1
      },
      {
        id: 4,
        name: 'Sunflower oil',
        sku: 'OIL-001',
        hsn: '1512',
        price: 190,
        qty: 2
      }
    ]
  };
}

test('invoice figures match the customer-billed GST breakdown and total', function () {
  var order = mixedRateOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lineRates: invoiceFigures.rows.map(function (row) { return row.gstPercent; }),
      lineTaxes: invoiceFigures.rows.map(function (row) { return row.lineTax; })
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      lineRates: billed.lines.map(function (line) { return line.gstPercent; }),
      lineTaxes: billed.lines.map(function (line) { return line.tax; })
    }
  );
});

test('invoice uses HSN GST slabs when an item has no gstRate', function () {
  var order = mixedRateOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total
    },
    {
      tax: 45.90,
      cgst: 22.95,
      sgst: 22.95,
      total: 963.90
    }
  );

  assert.deepEqual(
    {
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lineRates: invoiceFigures.rows.map(function (row) { return row.gstPercent; })
    },
    {
      tax: 45.90,
      cgst: 22.95,
      sgst: 22.95,
      total: 963.90,
      lineRates: [5, 5]
    }
  );
});

test('invoice applies a percentage coupon before GST, matching billed totals', function () {
  var order = mixedRateOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 102.00);
  assert.equal(invoiceFigures.discount, 102.00);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice preserves a decimal gstRate used by the billed total', function () {
  var order = {
    coupon: '',
    items: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstRate: 0.05,
      price: 100,
      qty: 1
    }]
  };
  var billed = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 5.00);
  assert.equal(billed.total, 105.00);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5.00);
  assert.equal(invoiceFigures.total, 105.00);
});

test('rendered invoice has no reconciliation notice when figures match the billed total', function () {
  var order = mixedRateOrder();
  var html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
});
