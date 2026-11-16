/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import type { NextConfig } from "next";

// 독립 실행 배포를 위해 파일 추적 기준을 현재 프로젝트로 지정한다.
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
