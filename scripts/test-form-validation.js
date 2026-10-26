import assert from "node:assert/strict";

console.log("🧪 Testing Contact Form Validation & State Rules...");

function validateContactForm(formState) {
  const newErrors = {};
  const nameTrim = (formState.name || "").trim();
  const emailTrim = (formState.email || "").trim();
  const messageTrim = (formState.message || "").trim();

  if (!nameTrim) {
    newErrors.name = "Please enter your name.";
  } else if (nameTrim.length < 2) {
    newErrors.name = "Name must be at least 2 characters.";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailTrim) {
    newErrors.email = "Please enter your email address.";
  } else if (!emailRegex.test(emailTrim)) {
    newErrors.email = "Please enter a valid email address (e.g. name@domain.com).";
  }

  if (formState.phone && formState.phone.trim()) {
    const phoneClean = formState.phone.replace(/[\s\-()]/g, "");
    if (phoneClean.length < 7 || phoneClean.length > 15) {
      newErrors.phone = "Please enter a valid phone number (7-15 digits).";
    }
  }

  if (!messageTrim) {
    newErrors.message = "Please enter a message before sending.";
  } else if (messageTrim.length < 5) {
    newErrors.message = "Message must be at least 5 characters.";
  }

  return {
    isValid: Object.keys(newErrors).length === 0,
    errors: newErrors,
  };
}

// Test 1: Empty form
const emptyResult = validateContactForm({ name: "", email: "", phone: "", subject: "", message: "" });
assert.strictEqual(emptyResult.isValid, false);
assert.strictEqual(emptyResult.errors.name, "Please enter your name.");
assert.strictEqual(emptyResult.errors.email, "Please enter your email address.");
assert.strictEqual(emptyResult.errors.message, "Please enter a message before sending.");
console.log("✓ Empty form validation test passed");

// Test 2: Invalid email & short name
const invalidEmailResult = validateContactForm({ name: "A", email: "not-an-email", phone: "", subject: "", message: "Hello world" });
assert.strictEqual(invalidEmailResult.isValid, false);
assert.strictEqual(invalidEmailResult.errors.name, "Name must be at least 2 characters.");
assert.strictEqual(invalidEmailResult.errors.email, "Please enter a valid email address (e.g. name@domain.com).");
console.log("✓ Short name & invalid email validation test passed");

// Test 3: Invalid phone length
const invalidPhoneResult = validateContactForm({ name: "Ada Lovelace", email: "ada@example.com", phone: "123", subject: "", message: "Let's organize a compiler workshop!" });
assert.strictEqual(invalidPhoneResult.isValid, false);
assert.strictEqual(invalidPhoneResult.errors.phone, "Please enter a valid phone number (7-15 digits).");
console.log("✓ Invalid phone validation test passed");

// Test 4: Short message (< 5 characters)
const shortMsgResult = validateContactForm({ name: "Ada Lovelace", email: "ada@example.com", phone: "+91 98765 43210", subject: "", message: "Hey" });
assert.strictEqual(shortMsgResult.isValid, false);
assert.strictEqual(shortMsgResult.errors.message, "Message must be at least 5 characters.");
console.log("✓ Short message validation test passed");

// Test 5: Fully valid form
const validResult = validateContactForm({
  name: "Alan Turing",
  email: "alan@bletchley.ac.uk",
  phone: "+91 98765 43210",
  subject: "Event Idea: Hear me out, bro",
  message: "I have an idea for an enigma machine decoding challenge at TechBloom!",
});
assert.strictEqual(validResult.isValid, true);
assert.strictEqual(Object.keys(validResult.errors).length, 0);
console.log("✓ Fully valid submission test passed");

console.log("\n🎯 ALL 5 FORM VALIDATION TESTS PASSED!");
