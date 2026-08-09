import React from 'react';
import RoomCard from './RoomCard';
import './RoomList.css';

export default function RoomList({ rooms, onRoomJoined }) {
  return (
    <div className="room-list">
      <h3 className="room-list-title">Available Rooms</h3>
      <div className="rooms-grid">
        {rooms.map(room => (
          <RoomCard
            key={room._id}
            room={room}
            onJoined={onRoomJoined}
          />
        ))}
      </div>
    </div>
  );
}
