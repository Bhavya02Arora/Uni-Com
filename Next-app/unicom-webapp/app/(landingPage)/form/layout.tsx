type Props = {
    children: React.ReactNode;
    };

const MainLayout = ({ children }: Props) => {
    return (
        <div>
            <main>{children}</main>
        </div>
    );
}

export default MainLayout;