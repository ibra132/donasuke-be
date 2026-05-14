const crypto = require("crypto");
const { env } = require("process");

const orderId = "DON-cmp4zdnz400017ksse4yo3wnp"; // midtransOrderId
const statusCode = "200";
const grossAmount = "50000.00"; // amount + .00 (selalu 2 desimal)
const serverKey = process.env.MIDTRANS_SERVER_KEY; // dari .env

const sig = crypto
  .createHash("sha512")
  .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
  .digest("hex");

console.log(sig);
