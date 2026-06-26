import "./chatPage.css";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Markdown from "react-markdown";
import { IKImage } from "imagekitio-react";
import { Fragment } from "react";
import { useAuth } from "@clerk/clerk-react";

const ChatPage = () => {
  const path = useLocation().pathname;
  const chatId = path.split("/").pop();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const { isPending, error, data } = useQuery({
    queryKey: ["chat", chatId],
    enabled: isLoaded && isSignedIn && !!chatId,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch chat");
      return res.json();
    },
  });

  return (
    <div className="chatPage">
      <div className="wrapper">
        <div className="chat">
          {!isLoaded || isPending
            ? "Loading..."
            : error
            ? "Something went wrong!"
            : data?.history?.map((message, i) => (
                <Fragment key={i}>
                  {message.img && (
                    <IKImage
                      urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
                      path={message.img}
                      height="300"
                      width="400"
                      transformation={[{ height: 300, width: 400 }]}
                      loading="lazy"
                      lqip={{ active: true, quality: 20 }}
                    />
                  )}
                  <div className={message.role === "user" ? "message user" : "message"}>
                    <span className="senderLabel">
                      {message.role === "user" ? "You" : "ByteBot"}
                    </span>
                    <Markdown>{message.parts[0].text}</Markdown>
                  </div>
                </Fragment>
              ))}
          {data && <NewPrompt data={data} />}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
