// Synthetic offline classifier: map the first weight to the notice label.
export const capabilities = {
  async "notice.list"() {
    const weights = await elecon.assets.readBytes("assets/weights.bin", { offset: 0, length: 1 });
    const bytes = await elecon.assets.readBytes("assets/labels.json");
    // The example labels use ASCII.
    const labels = JSON.parse(String.fromCharCode(...bytes));
    return { items: [{ id: "welcome", title: labels[weights[0]], category: "academic", source: "Local example" }] };
  },
};
