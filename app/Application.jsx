import Sidebar from "@/components/Sidebar";
export default function Application(){
    return (
        <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
            {/* Main content goes here */}
        </main>
        </div>
    );
}