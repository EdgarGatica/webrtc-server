package controllers;
import akka.actor.ActorSystem;
import akka.stream.Materializer;
import akka.stream.javadsl.Flow;
import com.fasterxml.jackson.databind.JsonNode;
import play.libs.F;
import play.libs.streams.ActorFlow;
import play.mvc.*;
import services.SignalingServer;

import javax.inject.Inject;
import java.util.concurrent.CompletableFuture;

/**
 * This controller contains an action to handle HTTP requests
 * to the application's home page.
 */
public class HomeController extends Controller {

    private final ActorSystem actorSystem;
    private final Materializer materializer;

    @Inject
    public HomeController(ActorSystem system, Materializer materializer) {
        this.actorSystem = system;
        this.materializer = materializer;
    }

    /**
     * An action that renders an HTML page with a welcome message.
     * The configuration in the <code>routes</code> file means that
     * this method will be called when the application receives a
     * <code>GET</code> request with a path of <code>/</code>.
     */
    public Result index() {
        return ok(views.html.index.render());
    }

    public WebSocket socket() {
        return WebSocket.Json.acceptOrResult(request -> {
            if(sameOriginCheck(request)) {
                Flow<JsonNode, JsonNode, ?> f2 = ActorFlow.actorRef(SignalingServer::props, actorSystem, materializer);
                return CompletableFuture.completedFuture(F.Either.Right(f2));
            } else {
                return CompletableFuture.completedFuture(F.Either.Left(forbidden()));
            }
        });
    }

    private boolean sameOriginCheck(Http.RequestHeader rh) {
        return rh.header("Origin").filter(this::originMatches).isPresent();
    }

    private boolean originMatches(String origin) {
        return origin.contains("localhost:9000") ||
                origin.contains("192.168.0.22:9000") ||
                origin.contains("gatica.info");
    }
    /*
    public WebSocket dashboardSocket() {
        String username = session("name");
        return WebSocket.Json.acceptOrResult(request -> {
            if(sameOriginCheck(request) && !corrections.userInqueue(username)) {
                Flow<JsonNode, JsonNode, ?> f2 = ActorFlow.actorRef(DashboardUser::props, actorSystem, materializer);
                return CompletableFuture.completedFuture(F.Either.Right(f2));
            } else
                return CompletableFuture.completedFuture(F.Either.Left(forbidden()));
        });
    }

    @BodyParser.Of(BodyParser.Json.class)
    public Result dashboardRegistration() {
        JsonNode requestNode = request().body().asJson();
        JsonNode registrationNode = Json.newObject()
                .put("type", "register")
                .put("name", session("name"));
        actorSystem.actorSelection(requestNode.path("name").asText()).tell(registrationNode, ActorRef.noSender());
        return ok();
    }

 */

}
