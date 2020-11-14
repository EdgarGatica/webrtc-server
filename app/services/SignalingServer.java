package services;
import akka.actor.AbstractActor;
import akka.actor.ActorRef;
import akka.actor.Props;
import com.fasterxml.jackson.databind.JsonNode;
import play.libs.Json;


public class SignalingServer extends AbstractActor {

    private String name;
    private final ActorRef out;

    public SignalingServer(ActorRef out) {
        this.out = out;
    }

    // public String getName() {
    //     return this.name;
    // }

    // @Override
    // public void update() {
    //     JsonNode correction =  (JsonNode) corrections.getUpdate(this);
    //     if (correction != null) {
    //         out.tell(correction, self());
    //     }
    // }

    // @Override
    // public void setSubject(Subject sub) {
    //     this.corrections = sub;
    // }

    @Override
    public Receive createReceive() {
        return receiveBuilder()
                .match(JsonNode.class, (msg) -> {
                    String type = msg.path("type").asText();
                    if(type.equalsIgnoreCase("ready")) {
                        out.tell(Json.newObject()
                                    .put("type", "name")
                                    .set("message", Json.newObject().put("name", this.name)),
                                self()
                        );
                    } else if(type.equalsIgnoreCase("register")) {
                        this.name = msg.path("name").asText();
                        // corrections.register(this);
                    }
                })
                .build();
    }

    @Override
    public void postStop() {
        // corrections.unregister(this);
    }

    @Override
    public void preStart() {
        // setSubject(LabController.corrections);
        this.name = self().path().toStringWithoutAddress();
        // corrections.preRegister(this);
    }

    public static Props props(ActorRef out) {
        return Props.create(SignalingServer.class, out);
    }
}