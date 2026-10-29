import React from 'react';
import { OrderStatus, OrderType } from '../../types';
import { getStatusInfo, getOrderTypeInfo } from './formatters';
import { Bike, ShoppingBag } from 'lucide-react';

interface StatusBadgeProps {
  status: OrderStatus;
  orderType?: OrderType;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  orderType = 'delivery',
  size = 'md',
}) => {
  const info = getStatusInfo(status, orderType);

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${info.badgeBg} ${info.textColor} ${info.borderColor} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {info.pulsing && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${info.dotColor} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${info.dotColor}`} />
      </span>
      {info.label}
    </span>
  );
};

interface OrderTypeBadgeProps {
  type: OrderType;
  showIcon?: boolean;
}

export const OrderTypeBadge: React.FC<OrderTypeBadgeProps> = ({ type, showIcon = true }) => {
  const info = getOrderTypeInfo(type);
  const isDelivery = type === 'delivery';

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border ${
        isDelivery
          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
          : 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
      }`}
    >
      {showIcon && (isDelivery ? <Bike className="w-3 h-3 text-orange-400" /> : <ShoppingBag className="w-3 h-3 text-zinc-300" />)}
      {info.shortLabel}
    </span>
  );
};
