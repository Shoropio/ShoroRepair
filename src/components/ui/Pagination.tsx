import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    itemsPerPage?: number;
}

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage = 10
}) => {
    const { t } = useTranslation();

    if (totalPages <= 1) return null;

    const startIdx = (currentPage - 1) * itemsPerPage + 1;
    const endIdx = Math.min(currentPage * itemsPerPage, totalItems || 0);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                {totalItems ? (
                    <>
                        {t('common.showing')} <span className="text-blue-600">{startIdx}</span> - <span className="text-blue-600">{endIdx}</span> {t('common.of')} <span className="text-[#202124] dark:text-white">{totalItems}</span> {t('common.results')}
                    </>
                ) : (
                    <>
                        {t('common.page')} <span className="text-blue-600">{currentPage}</span> {t('common.of')} <span className="text-[#202124] dark:text-white">{totalPages}</span>
                    </>
                )}
            </div>

            <div className="flex items-center bg-white dark:bg-[#1a1c1e] shadow-xl shadow-black/5 border border-[#f1f3f4] dark:border-white/5 p-1 rounded-none">
                <button
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(1)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/5 transition-all rounded-none disabled:opacity-20 disabled:pointer-events-none"
                >
                    <ChevronsLeft size={16} />
                </button>
                <button
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/5 transition-all rounded-none disabled:opacity-20 disabled:pointer-events-none"
                >
                    <ChevronLeft size={16} />
                </button>

                <div className="px-6 h-8 flex items-center border-x border-[#f1f3f4] dark:border-white/5">
                    <span className="text-[11px] font-black tracking-widest text-[#202124] dark:text-white">
                        {String(currentPage).padStart(2, '0')}
                    </span>
                </div>

                <button
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/5 transition-all rounded-none disabled:opacity-20 disabled:pointer-events-none"
                >
                    <ChevronRight size={16} />
                </button>
                <button
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(totalPages)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/5 transition-all rounded-none disabled:opacity-20 disabled:pointer-events-none"
                >
                    <ChevronsRight size={16} />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
