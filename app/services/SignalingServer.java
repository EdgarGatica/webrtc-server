package services;
import akka.actor.AbstractActor;
import akka.actor.ActorRef;
import akka.actor.Props;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import play.libs.Json;
import scala.util.Random;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;


public class SignalingServer extends AbstractActor {
    private static Random generator = new Random();
    private static Map<Integer, ActorRef> connectionMap = new ConcurrentHashMap<>(20, 0.75f, 20);
    private String name;
    private int id;
    private final ActorRef out;

    public SignalingServer(ActorRef out) {
        this.out = out;
    }

    /**
     * Method for handling incoming messages.
     * @return
     */
    @Override
    public Receive createReceive() {
        return receiveBuilder()
                .match(JsonNode.class, (msg) -> {
                    String destination = msg.path("destination").asText();
                    System.out.println("'" + destination + "'");
                    if(destination.equals("server")) {
                        System.out.println(msg);
                    } else if(destination.equals("broadcast")) {
                        for (Map.Entry<Integer, ActorRef> entry : connectionMap.entrySet()) {
                            if(entry.getKey() == this.id) {
                                continue;
                            }
                            entry.getValue().tell(Json.newObject()
                                        .put("type", "broadcast")
                                        .put("source", this.id)
                                        .put("message", msg.path("message").asText()),
                                    self());
                        }
                    } else if(msg.path("destination").asInt(-999) > 1) {
                        int destinationID = msg.path("destination").asInt();
                        System.out.println("Forwarding message to: " + destinationID);
                        connectionMap.get(destinationID).tell(Json.newObject()
                                        .put("type", "direct")
                                        .put("source", this.id)
                                        .put("message", msg.path("message").asText()),
                                self());
                    } else {
                        System.out.println("Unexpected destination");
                    }
                })
                .build();
    }

    /**
     * Callback for a closed connection.
     */
    @Override
    public void postStop() {
        connectionMap.remove(this.id);
//        for (Map.Entry<Integer, ActorRef> entry : connectionMap.entrySet()) {
//            entry.getValue().tell(Json.newObject()
//                            .put("type", "user_exit")
//                            .put("source", "server")
//                            .put("message", this.id),
//                    self());
//        }
        ArrayNode userIDs = Json.newArray();
        for(Integer id : connectionMap.keySet()) {
            System.out.println(id);
            userIDs.add(id);
        }
        for (Map.Entry<Integer, ActorRef> entry : connectionMap.entrySet()) {
            entry.getValue().tell(Json.newObject()
                            .put("type", "current_user_list")
                            .put("source", "server")
                            .set("message", userIDs),
                    self());
        }
    }

    /**
     * Callback for an established connection.
     */
    @Override
    public void preStart() {
        this.id = generator.nextInt(10000);
        out.tell(Json.newObject()
                    .put("type", "id")
                    .put("message", this.id),
                self()
        );
//        for (Map.Entry<Integer, ActorRef> entry : connectionMap.entrySet()) {
//            entry.getValue().tell(Json.newObject()
//                            .put("type", "user_join")
//                            .put("source", "server")
//                            .put("message", this.id),
//                    self());
//        }
        connectionMap.put(this.id, this.out);
        ArrayNode userIDs = Json.newArray();
        for(Integer id : connectionMap.keySet()) {
            System.out.println(id);
            userIDs.add(id);
        }
        for (Map.Entry<Integer, ActorRef> entry : connectionMap.entrySet()) {
            entry.getValue().tell(Json.newObject()
                            .put("type", "current_user_list")
                            .put("source", "server")
                            .set("message", userIDs),
                    self());
        }
    }

    public static Props props(ActorRef out) {
        return Props.create(SignalingServer.class, out);
    }
}