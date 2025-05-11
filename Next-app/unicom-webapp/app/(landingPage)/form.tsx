import Image from "next/image";

export const Header = () => {
    return (
      <header className="h-20 w-full border-b-4 border-slate-200 ">
        
        {/* <div className="lg:max-w-screen-lg mx-auto flex items-center justify-between h-full"> */}
        <div className="pt-0.75 pl-9 pb-7 flex items-center gap-x-1">
          <Image src="./file.svg" height={90} width={125} alt="Mascot" />
          <h1 className="text-5xl font-extrabold text-orange-500 tracking-wide">UniCom</h1>
          </div>

        {/* </div> */}
      </header>
    );
  };