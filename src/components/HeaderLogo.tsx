"use client";
import React, { useEffect, useState } from "react";
import Logo from "./Logo";
import { useColorPalette } from "@/hooks/useColorPalette";

const HeaderLogo: React.FC = () => {
  const { colors } = useColorPalette();
  const [currentColors, setCurrentColors] = useState({
    start: colors[0],
    end: colors[1],
  });

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % (colors.length - 1);
      setCurrentColors({
        start: colors[nextIndex],
        end: colors[nextIndex + 1],
      });
      currentIndex = nextIndex;
    }, 4000);
    return () => clearInterval(interval);
  }, [colors]);

  return (
    <div className="fixed top-4 left-4 md:top-8 md:left-16 z-50">
      <Logo
        width={75}
        height={93}
        className="md:w-[100px] md:h-[124px] w-[75px] h-[93px] transition-all duration-300"
        gradient={currentColors}
      />
    </div>
  );
};

export default HeaderLogo;
