function validateEmail(email) {
    if (!email) return false;
    return email.trim().endsWith('@bannari.com');
}
