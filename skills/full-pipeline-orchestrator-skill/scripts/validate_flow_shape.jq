($T[0]) as $t |

def is_uuidv4($id):
  $id | test("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"; "i");

def allowed_data_keys($type):
  if $type == "episodeNode" then ["episodes", "activeEpisodeId"]
  elif $type == "sceneNode" then ["title", "scenes", "total_batches", "current_batch", "processed_scene_ids"]
  elif $type == "sceneImageNode" then ["id", "sceneId", "images", "imageUrl", "prompt"]
  elif $type == "sceneVideoNode" then ["id", "sceneId", "videos", "prompt"]
  elif $type == "videoPreviewNode" then ["episodes"]
  elif $type == "assetNode" then ["activeTab", "assets", "selectedId"]
  else []
  end;

def allowed_node_keys($type):
  if $type == "videoPreviewNode" then ["id","type","position","selectable","data","dragging","measured"]
  elif $type == "assetNode" then ["id","type","position","data","selected","dragging","measured"]
  elif $type == "sceneNode" then ["id","type","position","data","measured","selected","dragging","hidden"]
  elif $type == "sceneImageNode" or $type == "sceneVideoNode" then ["id","type","position","data","hidden","measured","selected","dragging"]
  elif $type == "episodeNode" then ["id","type","position","data","measured","selected","dragging"]
  else []
  end;

def get_nodes_by_type($type):
  $t.nodes // [] | map(select(.type == $type));

[
  (if ($t | type) != "object" then "flow.json root must be an object" else empty end),
  (if (($t.nodes // null) | type) != "array" then "nodes must be an array" else empty end),
  (if (($t.edges // null) | type) != "array" then "edges must be an array" else empty end),

  # 校验所有节点ID是UUIDv4格式
  (
    ($t.nodes // []) | to_entries[] |
    .key as $i |
    .value.id as $nid |
    select($nid != "" and is_uuidv4($nid) | not) |
    "nodes[\($i)] id \($nid) is not a valid UUIDv4"
  ),

  # 校验所有边ID是UUIDv4格式
  (
    ($t.edges // []) | to_entries[] |
    .key as $i |
    .value.id as $eid |
    select($eid != "" and is_uuidv4($eid) | not) |
    "edges[\($i)] id \($eid) is not a valid UUIDv4"
  ),

  # 校验必须存在的节点类型
  (
    ["episodeNode", "sceneNode", "assetNode", "videoPreviewNode"][] as $type |
    select((get_nodes_by_type($type) | length) == 0) |
    "Missing required node type: \($type)"
  ),

  (
    ($t.nodes // []) | to_entries[] |
    .key as $i |
    .value as $n |
    ($n.id // "") as $nid |
    ($n.type // "") as $ty |
    if ($n | type) != "object" then
      "nodes[\($i)] must be object"
    elif $nid == "" then
      "nodes[\($i)] missing id"
    elif $ty == "" then
      "Node \($nid): missing type"
    elif (["episodeNode","sceneNode","sceneImageNode","sceneVideoNode","videoPreviewNode","assetNode"] | index($ty)) == null then
      "Node \($nid): unsupported type \($ty)"
    elif (($n.data // null) | type) != "object" then
      "Node \($nid): data must be object"
    else
      (
        ($n | keys_unsorted[]) as $k |
        select((allowed_node_keys($ty) | index($k)) == null) |
        "Node \($nid): unsupported field \($k)"
      ),
      (
        (($n.data // {}) | keys_unsorted[]) as $k |
        select((allowed_data_keys($ty) | index($k)) == null) |
        "Node \($nid): unsupported data field \($k)"
      )
    end
  ),

  # 校验节点ID不重复
  (
    ($t.nodes // []) | map(.id) | group_by(.)[] | select(length > 1) | .[0] |
    "Duplicate node id: \(.)"
  ),

  # 校验边ID不重复
  (
    ($t.edges // []) | map(.id) | group_by(.)[] | select(length > 1) | .[0] |
    "Duplicate edge id: \(.)"
  ),

  # 校验episodeNode结构
  (
    get_nodes_by_type("episodeNode")[] |
    .id as $nid |
    select(((.data.episodes // null) | type) != "array") |
    "Node \($nid) (episodeNode): data.episodes must be an array"
  ),

  # 校验sceneNode结构
  (
    get_nodes_by_type("sceneNode")[] |
    .id as $nid |
    select(((.data.scenes // null) | type) != "array") |
    "Node \($nid) (sceneNode): data.scenes must be an array"
  ),

  # 校验assetNode结构
  (
    get_nodes_by_type("assetNode")[] |
    .id as $nid |
    select(((.data.assets // null) | type) != "object") |
    "Node \($nid) (assetNode): data.assets must be an object"
  ),
  (
    get_nodes_by_type("assetNode")[] |
    .id as $nid |
    .data.assets as $a |
    ["characters","scenes","props","audio"][] as $bucket |
    select(($a | has($bucket) | not)) |
    "Node \($nid) (assetNode): data.assets missing bucket \($bucket)"
  ),

  # 校验边结构
  (
    ($t.edges // []) | to_entries[] |
    .key as $i |
    .value as $e |
    if ($e | type) != "object" then
      "edges[\($i)] must be object"
    else
      (($e.source // "") as $s | select($s == "") | "edges[\($i)] missing source"),
      (($e.target // "") as $tg | select($tg == "") | "edges[\($i)] missing target"),
      (($e.source // empty) as $s | select((($t.nodes // []) | any(.id == $s)) | not) | "edges[\($i)] source=\($s) not found"),
      (($e.target // empty) as $tg | select((($t.nodes // []) | any(.id == $tg)) | not) | "edges[\($i)] target=\($tg) not found")
    end
  ),

   # 路径合法性校验函数
   def is_valid_asset_path($url):
     $url | test("^/assets/(characters|scenes|props)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.png$"; "i");
   def is_valid_shot_image_path($url):
     $url | test("^/episode/image/ep-\\d{2}-p\\d{2}-first\\.png$");
   def is_valid_video_path($url):
     $url | test("^/episode/video/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.mp4$"; "i");

   # Strict模式校验
   (
     if $strict == 1 then
       (
         get_nodes_by_type("episodeNode")[] |
         select((.data.activeEpisodeId // "") == "") |
         "episodeNode.data.activeEpisodeId is required in strict mode"
       ),
       (
         get_nodes_by_type("assetNode")[] |
         .id as $nid |
         (
           select((.data.assets.characters | length) < 1) |
           "Node \($nid) (assetNode): data.assets.characters must have at least 1 item in strict mode"
         ),
         (
           select((.data.assets.scenes | length) < 1) |
           "Node \($nid) (assetNode): data.assets.scenes must have at least 1 item in strict mode"
         ),
          (
            .data.assets.characters[] |
            select((.id // "") == "" or (.uuid // "") == "" or (.name // "") == "" or (.url // "") == "" or (.prompt // "") == "" |
            "Node \($nid) (assetNode): character asset missing required field (id/uuid/name/url/prompt)"
          ),
          (
            .data.assets.characters[] |
            select(.id != .uuid |
            "Node \($nid) (assetNode): character asset id (\(.id)) must be equal to uuid (\(.uuid))"
          ),
          (
            .data.assets.characters[] |
            select(is_valid_asset_path(.url) | not) |
            "Node \($nid) (assetNode): character asset url \(.url) is invalid, must match format /assets/characters/{UUID}.png"
          ),
          (
            .data.assets.scenes[] |
            select((.id // "") == "" or (.uuid // "") == "" or (.name // "") == "" or (.url // "") == "" or (.prompt // "") == "" |
            "Node \($nid) (assetNode): scene asset missing required field (id/uuid/name/url/prompt)"
          ),
          (
            .data.assets.scenes[] |
            select(.id != .uuid |
            "Node \($nid) (assetNode): scene asset id (\(.id)) must be equal to uuid (\(.uuid))"
          ),
          (
            .data.assets.scenes[] |
            select(is_valid_asset_path(.url) | not) |
            "Node \($nid) (assetNode): scene asset url \(.url) is invalid, must match format /assets/scenes/{UUID}.png"
          ),
          (
            .data.assets.props[] |
            select((.id // "") == "" or (.uuid // "") == "" or (.url // "") == "" or is_valid_asset_path(.url) | not |
            "Node \($nid) (assetNode): prop asset missing required field (id/uuid/url) or url invalid, must match format /assets/props/{UUID}.png"
          )
       ),
       (
         get_nodes_by_type("sceneImageNode")[] |
         .id as $nid |
         (
           .data.images[] |
           select(is_valid_shot_image_path(.url) | not) |
           "Node \($nid) (sceneImageNode): image url \(.url) is invalid, must match format /episode/image/ep-XX-pXX-first.png"
         )
       ),
       (
         get_nodes_by_type("sceneVideoNode")[] |
         .id as $nid |
         (
           .data.videos[] |
           select(is_valid_video_path(.url) | not) |
           "Node \($nid) (sceneVideoNode): video url \(.url) is invalid, must match format /episode/video/{UUID}.mp4"
         )
       )
     else empty end
   )
]
| flatten
| map(select(. != null and . != ""))
| .[]
