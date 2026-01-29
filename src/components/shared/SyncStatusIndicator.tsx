import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { syncManager, SyncStatus } from '../../offline/sync';

const SyncStatusIndicator: React.FC = () => {
    const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());

    useEffect(() => {
        return syncManager.subscribe((newStatus) => {
            setStatus(newStatus);
        });
    }, []);

    const getIcon = () => {
        switch (status) {
            case 'syncing':
                return <RefreshCw size={16} className="text-[#1a73e8] animate-spin" />;
            case 'offline':
                return <CloudOff size={16} className="text-[#5f6368] dark:text-[#9aa0a6]" />;
            case 'error':
                return <AlertCircle size={16} className="text-[#ea4335]" />;
            case 'idle':
            default:
                return <Cloud size={16} className="text-[#1a73e8]" />;
        }
    };

    const getLabel = () => {
        switch (status) {
            case 'syncing':
                return 'Sincronizando';
            case 'offline':
                return 'Desconectado';
            case 'error':
                return 'Error';
            case 'idle':
            default:
                return 'Sincronizado';
        }
    };

    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-none hover:bg-[#f1f3f4] dark:hover:bg-white/5 cursor-pointer transition-all duration-200 group"
            onClick={() => syncManager.sync()}
            title="Sincronizar ahora"
        >
            {getIcon()}
            <span className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] group-hover:text-[#1a73e8] dark:group-hover:text-[#8ab4f8]">
                {getLabel()}
            </span>
        </div>
    );
};

export default SyncStatusIndicator;
