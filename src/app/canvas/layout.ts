export function getPlayerPosition(
    index: number,
    total: number,
    cx: number,
    cy: number,
    radius: number
) {
    const angle = (2 * Math.PI / total) * index;
  
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
}