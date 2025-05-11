'use client';

import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Building2, Tag, CarFront } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <section
      className="w-full flex items-center justify-center px-4 py-20"
      style={{ 
        backgroundImage: "linear-gradient(135deg, #FFD8B0 0%, #FFD8B0 49%, #D6B38A 50%, #FFB375 51%, #FFB375 100%)" 
      }}
      // style={{
      //   backgroundImage: `
      //     linear-gradient(
      //       135deg,
      //       #FFD8B0 0%,
      //       #FFB375 50%,
      //       #D6B38A 100%
      //     )`,
      // }}
    >
      <div className="w-full max-w-6xl bg-[#fff7f2] rounded-3xl shadow-2xl px-8 py-12 lg:py-16 flex flex-col-reverse lg:flex-row items-center justify-between gap-16">
        
        {/* LEFT SIDE */}
        <div className="flex-1 flex flex-col justify-center space-y-6 text-neutral-900">
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
            Connect with your <span className="text-[#f76902]">RIT</span> community
          </h1>

          <p className="text-base sm:text-lg text-[#333] max-w-md leading-relaxed">
            Find roommates, sell items, arrange carpools, and more –
            all in one place, exclusively for RIT students. 
            <br /> <br />
            “Use UniCom beacuse it's search is as fast as O(1) — <br /> find what you want in constant time!”
          </p>

          {/* ✅ Animated 3D Buttons + Floating Mascot */}
          <div className="flex items-center gap-4 pt-2">
            {/* Get Started + Mascot */}
            <div className="relative inline-block">
              <Button
                asChild
                size="lg"
                className="bg-[#f76902] hover:bg-[#db5d00] text-white font-semibold border-2 border-[#f76902] px-6 py-2.5 rounded-md shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-200"
              >
                <Link href="/feed">Get Started</Link>
              </Button>
              {/* Mascot Image */}
              <div className="absolute -top-40 -left-72 w-74 h-124">
                <Image
                  src="ritchie.png"
                  alt="UniCom Mascot"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Learn More */}
            <Button
              asChild
              size="lg"
              variant="primaryOutline"
              className="border-2 border-[#f76902] text-[#f76902] hover:bg-orange-50 font-semibold px-6 py-2.5 rounded-md shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-200"
            >
              <Link href="/features">Learn More</Link>
            </Button>
          </div>

          {/* ✅ Animated Tags */}
          <div className="flex flex-wrap items-center gap-4 mt-6">
            {[
              { icon: <Building2 size={18} />, label: "Roommate Search" },
              { icon: <Tag size={18} />, label: "Buy & Sell" },
              { icon: <CarFront size={18} />, label: "Carpooling" },
            ].map((tag, index) => (
              <motion.div
                key={tag.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.1 * index,
                  ease: "easeOut",
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-white text-[#f76902] shadow-sm hover:shadow-md hover:scale-[1.03] transition-all duration-200"
              >
                {tag.icon}
                <span className="text-sm font-medium">{tag.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* IMAGE CARD */}
        <div className="flex-1 flex items-center justify-center">
          <div
            className="relative w-full max-w-sm h-64 sm:h-80 lg:h-[560px] rounded-2xl overflow-hidden transform transition-all duration-500 hover:rotate-[-3deg] hover:scale-105 shadow-[0_30px_60px_-10px_rgba(0,0,0,0.4)]"
            style={{ perspective: "1000px" }}
          >
            <Image
              src="/Tigers2.png"
              alt="Tigers using UniCom"
              fill
              priority
              className="object-cover rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}