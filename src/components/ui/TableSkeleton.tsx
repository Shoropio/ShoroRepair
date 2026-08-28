import React from 'react';
import Skeleton, { SkeletonTableRow } from './Skeleton';

interface TableSkeletonProps {
    columns?: number;
    rows?: number;
    title?: string;
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({
    columns = 4,
    rows = 6
}) => {
    return (
        <div className="space-y-8 animate-in">
            {/* Header Section Skeleton */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <Skeleton variant="rectangular" height={32} width={280} className="rounded-none" />
                    <Skeleton variant="text" width={200} className="rounded-none" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton variant="rectangular" height={44} width={150} className="rounded-none" />
                </div>
            </div>

            {/* Filter Bar Skeleton */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-[#f8f9fa] dark:bg-[#2d2f31] p-2 rounded-none">
                <div className="flex-1 w-full">
                    <Skeleton variant="rectangular" height={40} className="w-full rounded-none" />
                </div>
                <div className="w-full md:w-48">
                    <Skeleton variant="rectangular" height={40} className="w-full rounded-none" />
                </div>
            </div>

            {/* Table Skeleton */}
            <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-[#3c4043] rounded-none overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#f8f9fa] dark:bg-[#202124] border-b border-[#f1f3f4] dark:border-[#3c4043]">
                            {Array.from({ length: columns }).map((_, i) => (
                                <th key={i} className="px-6 py-4">
                                    <Skeleton
                                        variant="text"
                                        height={10}
                                        width={`${50 + Math.random() * 30}%`}
                                        className="rounded-none"
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: rows }).map((_, i) => (
                            <SkeletonTableRow key={i} columns={columns} />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer Skeleton */}
            <div className="flex items-center justify-between px-2">
                <Skeleton variant="text" width={100} className="rounded-none" />
                <div className="flex gap-2">
                    <Skeleton variant="rectangular" height={32} width={32} className="rounded-none" />
                    <Skeleton variant="rectangular" height={32} width={32} className="rounded-none" />
                    <Skeleton variant="rectangular" height={32} width={32} className="rounded-none" />
                </div>
            </div>
        </div>
    );
};

export default TableSkeleton;
