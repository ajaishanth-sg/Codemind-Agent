import styled, { keyframes } from "styled-components";

const gradient = keyframes`
  0% {
    background-position: 0px 0;
  }
  100% {
    background-position: 100em 0;
  }
`;

export const GradientBorder = styled.div<{
  borderRadius?: string;
  borderColor?: string;
  loading: 0 | 1;
}>`
  border-radius: ${(props) => props.borderRadius || "0"};
  padding: 1px;
  background: ${(props) =>
    props.borderColor
      ? "rgba(230, 36, 41, 0.4)"
      : `repeating-linear-gradient(
      101.79deg,
      #e62429 0%,
      #1d4ed8 25%,
      #ff2d34 50%,
      #2563eb 75%,
      #e62429 100%
    )`};
  animation: ${(props) => (props.loading ? gradient : "")} 6s linear infinite;
  background-size: 200% 200%;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: ${(props) => (props.loading ? "8px" : "")};
`;
