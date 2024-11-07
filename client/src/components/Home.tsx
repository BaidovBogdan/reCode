import React, { useState, useEffect, useRef } from 'react';
import { Avatar, Button, Input, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const Home: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [videoEnabled, setVideoEnabled] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const connectWebSocket = () => {
    ws.current = new WebSocket('ws://localhost:3001/');

    ws.current.onopen = () => {
      console.log('WebSocket connection established');
    };

    ws.current.onerror = (event) => {
      console.error('WebSocket error:', event);
    };

    ws.current.onclose = (event) => {
      console.error('WebSocket closed:', event);
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'offer':
          handleOffer(message.offer, message.username);
          break;
        case 'answer':
          handleAnswer(message.answer);
          break;
        case 'ice-candidate':
          handleIceCandidate(message.candidate);
          break;
        case 'message':
          setMessages((prevMessages) => [
            ...prevMessages,
            `${message.username}: ${message.content}`,
          ]);
          break;
        default:
          console.log('Unknown message type', message.type);
      }
    };
  };

  useEffect(() => {
    connectWebSocket();
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages]);

  const startVideoCall = async () => {
    if (!localVideoRef.current || !remoteVideoRef.current) return;

    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      peerConnectionRef.current = new RTCPeerConnection();
      peerConnectionRef.current.addEventListener(
        'icecandidate',
        handleIceCandidate,
      );
      peerConnectionRef.current.addEventListener('track', handleTrack);

      localStreamRef.current.getTracks().forEach((track) => {
        peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
      });

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      if (ws.current) {
        ws.current.send(
          JSON.stringify({
            type: 'offer',
            offer: offer,
            username: username,
            room_id: roomId,
          }),
        );
      }

      setVideoEnabled(true);
    } catch (error) {
      console.error('Ошибка при попытке начать видеозвонок:', error);
      message.error('Requested device not found');
    }
  };

  const handleOffer = async (
    offer: RTCSessionDescriptionInit,
    username: string,
  ) => {
    if (!peerConnectionRef.current) return;

    await peerConnectionRef.current.setRemoteDescription(offer);
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);

    if (ws.current) {
      ws.current.send(
        JSON.stringify({
          type: 'answer',
          answer: answer,
          username: username,
          room_id: roomId,
        }),
      );
    }
  };

  const handleAnswer = (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.setRemoteDescription(answer);
    }
  };

  const handleIceCandidate = (candidate: RTCIceCandidate) => {
    if (ws.current) {
      ws.current.send(
        JSON.stringify({
          type: 'ice-candidate',
          candidate: candidate,
          room_id: roomId,
        }),
      );
    }
  };

  const handleTrack = (event: RTCTrackEvent) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = event.streams[0];
    }
  };

  const sendMessage = () => {
    if (input == '') {
      message.error('Пожалуйста введите сообщение!');
    }
    if (ws.current && input && username) {
      ws.current.send(
        JSON.stringify({
          type: 'message',
          room_id: roomId,
          username: username,
          content: input,
        }),
      );
      setInput('');
    }
  };

  const handleUsernameChange = (string: string) => {
    setUsername(string);
    setMessages([]);
    localStorage.removeItem('chatMessages');
  };

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomId(e.target.value);
  };

  const SelectUser = ({ username }: { username: string }) => {
    return (
      <div className="flex flex-col">
        <Avatar shape="square" size={64} icon={<UserOutlined />} />
        <p className="text-center">{username}</p>
      </div>
    );
  };

  const toggleVideoCall = () => {
    if (videoEnabled) {
      setVideoEnabled(false);
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        tracks.forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    } else {
      startVideoCall();
    }
  };

  return (
    <div className="p-4">
      {!username ? (
        <div className="flex justify-center flex-col">
          <h1 className="text-center">Choose Username</h1>
          <div className="flex justify-center gap-10 mt-10">
            <div onClick={() => handleUsernameChange('User1')}>
              <SelectUser username="User1" />
            </div>
            <div onClick={() => handleUsernameChange('User2')}>
              <SelectUser username="User2" />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-center">
            <span>you {username}</span>
          </div>
          <div className="flex justify-center items-center">
            <div>
              <Input
                value={roomId}
                onChange={handleRoomIdChange}
                placeholder="Enter Room ID"
              />
              <Button onClick={toggleVideoCall}>
                {videoEnabled ? 'End Video Call' : 'Start Video Call'}
              </Button>
              <div className="flex mt-10 flex-col">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message"
                />
                <Button onClick={sendMessage}>Send</Button>
              </div>
            </div>
            <div>
              <video ref={localVideoRef} autoPlay />
              <video ref={remoteVideoRef} autoPlay />
            </div>
            <div className="rounded-xl border-black border p-4 w-96 flex flex-col overflow-hidden">
              {messages.map((message, index) => (
                <p className="break-words" key={index}>
                  {message}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
