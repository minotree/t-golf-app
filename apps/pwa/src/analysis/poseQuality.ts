interface VisiblePoint { x: number; y: number; visibility: number }

/** 검증용 휴리스틱. 신뢰도 점수나 스윙 정확도로 해석하지 않는다. */
export function hasVisibleJoints(pose: readonly VisiblePoint[]): boolean {
  return [0, 11, 12, 15, 16, 23, 24, 27, 28].every(key => {
    const point = pose[key];
    return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y)
      && Number.isFinite(point.visibility) && point.visibility >= 0.6
      && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
  });
}
