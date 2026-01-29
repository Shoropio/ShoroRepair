import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    lines?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rectangular',
    width,
    height,
    lines = 1
}) => {
    const baseStyles = "animate-pulse bg-[#f1f3f4] dark:bg-[#2d2f31]";

    const variants = {
        text: "h-3 w-full rounded-none",
        circular: "rounded-none aspect-square",
        rectangular: "rounded-none",
    };

    const style: React.CSSProperties = {
        width: width || '100%',
        height: height,
    };

    if (lines > 1) {
        return (
            <div className="space-y-3">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={`${baseStyles} ${variants.text} ${className}`}
                        style={{
                            ...style,
                            width: i === lines - 1 ? '60%' : '100%'
                        }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`${baseStyles} ${variants[variant]} ${className}`}
            style={style}
        />
    );
};

export const SkeletonStatCard: React.FC = () => (
    <div className="bg-white dark:bg-[#1a1c1e] p-6 border border-[#dadce0] dark:border-[#3c4043] rounded-none">
        <div className="flex items-center justify-between mb-6">
            <Skeleton variant="rectangular" width={40} height={40} className="rounded-none" />
            <Skeleton variant="rectangular" width={24} height={6} />
        </div>
        <div className="space-y-3">
            <Skeleton variant="rectangular" width="40%" height={24} />
            <Skeleton variant="text" width="60%" />
        </div>
    </div>
);

export const SkeletonListItem: React.FC = () => (
    <div className="flex items-center justify-between py-4 border-b border-[#f1f3f4] dark:border-[#3c4043]">
        <div className="flex items-center gap-4">
            <Skeleton variant="rectangular" width={48} height={48} className="rounded-none" />
            <div className="space-y-2">
                <Skeleton variant="text" width={140} height={12} />
                <Skeleton variant="text" width={90} height={8} />
            </div>
        </div>
        <Skeleton variant="rectangular" width={70} height={24} className="rounded-none" />
    </div>
);

export const SkeletonChart: React.FC = () => (
    <div className="h-64 flex items-end justify-around gap-6 px-4">
        {[30, 70, 50, 90, 40, 60].map((h, i) => (
            <div key={i} className="w-12 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" style={{ height: `${h}%` }} />
        ))}
    </div>
);

export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 4 }) => (
    <tr className="border-b border-[#f1f3f4] dark:border-[#3c4043]">
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} className="px-6 py-5">
                <Skeleton variant="text" width={i === 0 ? "70%" : "50%"} height={10} />
            </td>
        ))}
    </tr>
);

export const SkeletonPage: React.FC = () => (
    <div className="space-y-10 animate-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
                <Skeleton variant="rectangular" width={320} height={32} />
                <Skeleton variant="text" width={220} />
            </div>
            <Skeleton variant="rectangular" width={160} height={44} className="rounded-none" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton variant="rectangular" height={400} className="lg:col-span-2" />
            <Skeleton variant="rectangular" height={400} />
        </div>
    </div>
);

export default Skeleton;
