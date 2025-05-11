import { Footer } from "./footer";
import { Header } from "./header";

type Props = {
  children: React.ReactNode;
};

const LandingPageLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 px-6 pt-6 pb-24">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default LandingPageLayout;


// app/landingPage/layout.tsx
// import { Footer } from './footer';
// import { Header } from './header';

// type Props = {
//   children: React.ReactNode;
// };

// const LandingPageLayout = ({ children }: Props) => {
//   return (
//     <div className="min-h-screen flex flex-col">
//       <Header />
//       <main className="flex-1 container mx-auto p-8">
//         {children}
//       </main>
//       <Footer />
//     </div>
//   );
// };

// export default LandingPageLayout;