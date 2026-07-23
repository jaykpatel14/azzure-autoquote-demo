type AuthMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendAuthMail(message: AuthMail) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[mail] to=${message.to} subject=${message.subject}`);
    console.info(message.text);
    return;
  }

  console.info(`[mail] to=${message.to} subject=${message.subject}`);
}
