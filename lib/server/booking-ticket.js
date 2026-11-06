import { createHash, createHmac } from 'node:crypto';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

function signingSecret() {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret) throw new Error('QR_SIGNING_SECRET is not configured.');
  return secret;
}

export function createBookingTicketToken(bookingId) {
  return createHmac('sha256', signingSecret())
    .update(`booking-ticket:v1:${bookingId}`)
    .digest('base64url');
}

export function hashBookingTicketToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function bookingTicketUrl(bookingId) {
  const token = createBookingTicketToken(bookingId);
  const url = new URL('/staff', process.env.APP_ORIGIN || 'http://localhost:3000');
  url.searchParams.set('ticket', token);
  return url.toString();
}

function pdfText(value) {
  return String(value).normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
}

function createPdf(booking, qrPng) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Golf E-Ticket ${booking.reference}` } });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));

    document.rect(0, 0, document.page.width, 16).fill('#0F2A20');
    document.fillColor('#0F2A20').font('Helvetica-Bold').fontSize(21)
      .text('DAMAI INDAH GOLF', 48, 48, { characterSpacing: 1.4 });
    document.fillColor('#9B7A3C').font('Helvetica').fontSize(9)
      .text('E-TICKET RESERVASI / RESERVATION', 48, 79, { characterSpacing: 2 });
    document.moveTo(48, 101).lineTo(547, 101).strokeColor('#D8D1C2').stroke();

    document.fillColor('#0F2A20').font('Helvetica-Bold').fontSize(18)
      .text(pdfText(booking.reference), 48, 122);
    document.fillColor('#565D58').font('Helvetica').fontSize(11)
      .text(pdfText(booking.guest.name), 48, 151);

    const rows = [
      ['Lapangan / Course', booking.courseName],
      ['Tanggal / Date', booking.displayDate],
      ['Waktu Main / Tee-off', booking.time],
      ['Pemain / Players', String(booking.players)],
      ['Nomor Tee Box / Tee Box', booking.teeBox],
      ['Paket / Package', booking.packageType],
      ['Total dibayar di klub / Total due', booking.totalLabel],
    ];
    let y = 192;
    for (const [label, value] of rows) {
      document.fillColor('#737A74').font('Helvetica').fontSize(9).text(label.toUpperCase(), 48, y);
      document.fillColor('#172C22').font('Helvetica-Bold').fontSize(11).text(pdfText(value), 190, y - 1);
      y += 34;
    }

    document.image(qrPng, 377, 180, { fit: [148, 148] });
    document.fillColor('#737A74').font('Helvetica').fontSize(8)
      .text('QR CHECK-IN STAF / STAFF', 377, 334, { width: 148, align: 'center', characterSpacing: 1 });
    document.moveTo(48, 420).lineTo(547, 420).strokeColor('#D8D1C2').stroke();
    document.fillColor('#0F2A20').font('Helvetica-Bold').fontSize(11)
      .text('ATURAN BERPAKAIAN & ETIKET / DRESS CODE', 48, 444);
    document.fillColor('#565D58').font('Helvetica').fontSize(10)
      .text('Gunakan pakaian golf berkerah dan sepatu golf yang sesuai. Datang lebih awal, jaga tempo permainan, perbaiki divot dan pitch mark, ratakan bunker, serta ikuti arahan starter. / Wear collared golf attire and appropriate golf shoes. Arrive early, respect the pace of play, repair divots and pitch marks, rake bunkers, and follow starter instructions.', 48, 467, { width: 490, lineGap: 4 });
    document.fillColor('#565D58').font('Helvetica').fontSize(9)
      .text('Pembatalan gratis hingga 24 jam sebelum Tee-off. Pembatalan setelahnya mengikuti kebijakan rain-check klub. Pembayaran dilakukan di klub; website ini tidak memproses pembayaran. / Free cancellation until 24 hours before tee-off. Later cancellations follow the club rain-check policy. Payment is made at the club; this website does not process payments.', 48, 526, { width: 490, lineGap: 4 });

    document.end();
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export async function buildBookingConfirmationEmail(booking) {
  const ticketUrl = bookingTicketUrl(booking.id);
  const qrPng = await QRCode.toBuffer(ticketUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 360,
    color: { dark: '#0F2A20', light: '#FFFFFF' },
  });
  const pdf = await createPdf(booking, qrPng);
  const fields = [
    ['Lapangan / Course', booking.courseName],
    ['Tanggal / Date', booking.displayDate],
    ['Waktu Main / Tee-off Time', booking.time],
    ['Pemain / Players', String(booking.players)],
    ['Nomor Tee Box / Tee Box', booking.teeBox],
    ['Paket / Package', booking.packageType],
    ['Total dibayar di klub / Total payable at the club', booking.totalLabel],
  ];
  const rows = fields.map(([label, value]) => `
    <tr>
      <td style="padding:12px 0;color:#6b756f;font-size:13px;border-bottom:1px solid #e8e5dc">${escapeHtml(label)}</td>
      <td style="padding:12px 0;color:#142d22;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e8e5dc">${escapeHtml(value)}</td>
    </tr>`).join('');
  const html = `<!doctype html>
<html lang="id"><body style="margin:0;padding:32px 12px;background:#f4f3ed;color:#142d22;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e1d5">
    <tr><td style="padding:30px 38px;background:#0f2a20;color:#fff">
      <div style="font-size:20px;letter-spacing:3px;font-weight:700">DAMAI INDAH GOLF</div>
      <div style="margin-top:8px;color:#d4b46a;font-size:10px;letter-spacing:2px">RESERVASI DIKONFIRMASI / RESERVATION CONFIRMED</div>
    </td></tr>
    <tr><td style="padding:34px 38px 10px">
      <p style="margin:0;color:#69736d;font-size:14px">Yth. / Dear ${escapeHtml(booking.guest.name)},</p>
      <h1 style="margin:10px 0 8px;color:#102b20;font-family:Georgia,serif;font-size:29px;font-weight:400">Ronde Anda telah dipesan / Your round is reserved.</h1>
      <p style="margin:0;color:#69736d;font-size:13px;line-height:1.7">Kami menantikan kedatangan Anda. Tunjukkan e-ticket di bawah ini kepada starter saat tiba. / We look forward to welcoming you. Please present the e-ticket below to our starter when you arrive.</p>
      <div style="margin:24px 0;padding:13px 16px;border-left:3px solid #b3944b;background:#f8f7f2">
        <div style="font-size:9px;letter-spacing:1px;color:#8b7441">NOMOR BOOKING / BOOKING REFERENCE</div>
        <div style="margin-top:5px;font-size:19px;letter-spacing:1px;font-weight:700;color:#102b20">${escapeHtml(booking.reference)}</div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;background:#f7f6f1">
        <tr><td style="padding:20px;text-align:center">
          <img src="cid:booking-ticket-qr" width="168" height="168" alt="QR code check-in booking / Booking check-in QR code" style="display:block;width:168px;height:168px;margin:0 auto;border:8px solid #fff">
          <div style="margin-top:12px;color:#69736d;font-size:11px;letter-spacing:1px">TUNJUKKAN QR INI SAAT CHECK-IN / PRESENT THIS QR AT CHECK-IN</div>
          <div style="margin-top:5px;color:#69736d;font-size:11px">E-ticket PDF terlampir / A PDF e-ticket is attached.</div>
        </td></tr>
      </table>
      <h2 style="margin:26px 0 8px;color:#102b20;font-family:Georgia,serif;font-size:18px;font-weight:400">Aturan berpakaian &amp; etiket / Dress code &amp; course etiquette</h2>
      <p style="margin:0;color:#69736d;font-size:12px;line-height:1.8">Gunakan pakaian golf berkerah dan sepatu golf yang sesuai. Datang lebih awal, jaga tempo permainan, perbaiki divot dan pitch mark, ratakan bunker, serta ikuti arahan starter. / Wear collared golf attire and appropriate golf shoes. Arrive early, respect the pace of play, repair divots and pitch marks, rake bunkers, and follow starter instructions.</p>
      <h2 style="margin:22px 0 8px;color:#102b20;font-family:Georgia,serif;font-size:18px;font-weight:400">Kebijakan pembatalan / Cancellation policy</h2>
      <p style="margin:0;color:#69736d;font-size:12px;line-height:1.8">Pembatalan gratis hingga 24 jam sebelum Tee-off. Pembatalan setelahnya mengikuti kebijakan rain-check klub; voucher member mengikuti ketentuan booking yang dipublikasikan. / Cancel at least 24 hours before tee-off for a free cancellation. Later cancellations follow the club rain-check policy; member vouchers are subject to the published booking terms.</p>
    </td></tr>
    <tr><td style="padding:20px 38px;background:#f4f3ed;color:#69736d;font-size:11px;line-height:1.7">
      Pembayaran dilakukan di klub. Website ini tidak memproses atau mengonfirmasi pembayaran. Untuk bantuan, hubungi klub sebelum Tee Time Anda. / Payment is made at the club. This website does not process or confirm payments. For assistance, contact the club before your tee time.
    </td></tr>
  </table>
</body></html>`;

  return {
    html,
    attachments: [
      { filename: 'booking-qr.png', content: qrPng.toString('base64'), content_type: 'image/png', content_id: 'booking-ticket-qr' },
      { filename: `e-ticket-${booking.reference}.pdf`, content: pdf.toString('base64'), content_type: 'application/pdf' },
    ],
  };
}
