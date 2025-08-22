// Simple token estimation test (simulated)
// This simulates our token estimation logic

function estimateTokens(text) {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

const testText = `
This is a sample chapter from a fantasy novel.
A brave knight named Sir Arthur embarked on a quest to find the magical crystal of Eldoria.
Along the way, he met Lyanna, a wise mage who offered her assistance.
Together, they traveled through the Darkwood Forest, a mysterious place filled with ancient trees and magical creatures.
The journey was treacherous, but their determination never wavered.
In the mystical city of Moonhaven, they discovered clues about the crystal's location.
`.trim();

console.log('=== Token Estimation Test ===');
console.log('Text length:', testText.length, 'characters');
console.log('Estimated tokens:', estimateTokens(testText));

// Simulate context window (typical chapter might be 2000-10000 tokens)
const longText = testText.repeat(50); // ~500 lines
console.log('\n=== Long Text Estimation ===');
console.log('Long text length:', longText.length, 'characters');
console.log('Long text tokens:', estimateTokens(longText));

// Cost simulation for GPT-4o-mini ($0.15/1M input tokens)
const inputCost = (estimateTokens(longText) * 0.15) / 1000000;
const outputCost = (500 * 0.60) / 1000000; // 500 output tokens
console.log('Estimated input cost: $', inputCost.toFixed(6));
console.log('Estimated output cost: $', outputCost.toFixed(6));
console.log('Total estimated cost: $', (inputCost + outputCost).toFixed(6));

if (inputCost + outputCost > 0.01) {
  console.log('⚠️  This would trigger a confirmation dialog');
} else {
  console.log('✅ This would auto-proceed (under $0.01)');
}
