/* Proprietary and confidential. See LICENSE. */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const { sendEmail } = require("./gmailHelper");

/**
 * Send notification email via Gmail API
 *
 * This function sends plain text or HTML emails to recipients.
 * Used by the Notifications Center to send email notifications.
 *
 * @param {Object} data
 * @param {string} data.to - Recipient email address
 * @param {string} data.subject - Email subject line
 * @param {string} data.message - Email body text
 * @param {string} [data.html] - Optional HTML body
 * @returns {Object} { success: boolean, messageId?: string, error?: string }
 */
const sendNotificationEmail = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    try {
      const { to, subject, message, html } = request.data || {};

      // Validate inputs
      if (!to || typeof to !== "string" || !to.includes("@")) {
        throw new HttpsError(
          "invalid-argument",
          "Missing or invalid recipient email",
        );
      }
      if (!subject || typeof subject !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid subject");
      }
      if (!message || typeof message !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid message");
      }

      const trimmedEmail = to.trim();

      const result = await sendEmail({
        to: trimmedEmail,
        subject,
        text: message,
        html: html || null,
        replyTo: process.env.GMAIL_REPLY_TO || null,
      });

      if (!result.success) {
        throw new HttpsError(
          "internal",
          result.error || "Failed to send email",
        );
      }

      logger.info("Notification email sent", {
        to: trimmedEmail,
        subject,
        messageId: result.messageId,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      logger.error("sendNotificationEmail error", {
        error: error?.message || error,
        code: error?.code,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to send email: ${error?.message || "Unknown error"}`,
      );
    }
  },
);

module.exports = { sendNotificationEmail };
